import { inArray } from 'drizzle-orm'
import { strFromU8, unzipSync } from 'fflate'
import * as z from 'zod'

const text = z.string().nullish().transform(v => v ?? null)
const doc = z.object({ type: z.literal('doc') }).loose().nullish().transform(v => v ?? null)
const asset = z.string().regex(/^assets\/[\w.-]+$/).nullish().transform(v => v ?? null)

const fileSchema = z.object({
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  encryption: z.object({ algorithm: z.literal('aes-256-gcm'), kdf: z.literal('scrypt'), salt: z.string() }).nullable(),
  project: z.object({
    name: z.string().min(1).max(120),
    description: text,
    status: z.enum(PROJECT_STATUSES),
    notes: doc,
    cover: asset
  }),
  techStacks: z.array(z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    category: z.enum(TECH_CATEGORIES),
    color: z.string().regex(/^[0-9A-Fa-f]{6}$/),
    simpleIcon: text,
    isCustom: z.boolean(),
    logo: asset
  })),
  environments: z.array(z.object({ ref: z.string(), name: z.string().min(1).max(40), isProduction: z.boolean() })),
  links: z.array(z.object({ app: text, type: z.enum(LINK_TYPES), label: z.string().min(1), url: httpUrl })),
  // Missing in files exported before infra existed.
  infra: z.array(z.object({ environment: text, type: z.enum(INFRA_TYPES), name: z.string().min(1).max(120), host: z.string().min(1).max(255), notes: text })).default([]),
  apps: z.array(z.object({
    ref: z.string(),
    name: z.string().min(1).max(120),
    description: text,
    platforms: z.array(z.enum(PLATFORMS)),
    notes: doc,
    techStacks: z.array(z.string()),
    deployments: z.array(z.object({
      environment: z.string(),
      url: httpUrl.nullish().transform(v => v ?? null),
      branch: text,
      notes: doc,
      releases: z.array(z.object({
        type: z.enum(RELEASE_TYPES),
        version: z.string().min(1),
        buildNumber: text,
        url: httpUrl.nullish().transform(v => v ?? null),
        releasedAt: text,
        changelog: text,
        status: z.enum(RELEASE_STATUSES)
      })),
      accounts: z.array(z.object({
        label: z.string().min(1),
        description: text,
        tags: z.array(z.string()),
        status: z.enum(TEST_ACCOUNT_STATUSES),
        lastVerifiedAt: text,
        fields: z.array(z.object({ key: z.string().min(1), value: z.string(), isSecret: z.boolean() }))
      })),
      envVars: z.array(z.object({ key: z.string().regex(ENV_KEY_PATTERN), value: z.string() }))
    }))
  }))
})

function fail(code: 'INVALID_FILE' | 'PASSPHRASE_REQUIRED' | 'INVALID_PASSPHRASE'): never {
  throw createError({ statusCode: 400, statusMessage: code })
}

export async function importProjectZip(zip: Uint8Array, groupId: string, passphrase?: string) {
  let files: Record<string, Uint8Array>
  let data: z.output<typeof fileSchema>
  try {
    files = unzipSync(zip)
    data = fileSchema.parse(JSON.parse(strFromU8(files['project.json']!)))
  } catch {
    fail('INVALID_FILE')
  }

  // Secrets in the file are encrypted with the passphrase; re-encrypt them with this instance's master key.
  let toLocal = (value: string) => encryptSecret(value)
  if (data.encryption) {
    if (!passphrase) {
      fail('PASSPHRASE_REQUIRED')
    }
    const key = deriveKey(passphrase, Buffer.from(data.encryption.salt, 'base64'))
    const sample = data.apps.flatMap(app => app.deployments.flatMap(d => [
      ...d.envVars.map(v => v.value),
      ...d.accounts.flatMap(a => a.fields.filter(f => f.isSecret).map(f => f.value))
    ])).find(Boolean)
    if (sample) {
      try {
        decryptWithKey(sample, key)
      } catch {
        fail('INVALID_PASSPHRASE')
      }
    }
    toLocal = value => encryptSecret(value ? decryptWithKey(value, key) : '')
  }

  const stored: string[] = []
  const storeAsset = async (path: string | null) => {
    const file = path ? files[path] : undefined
    if (!file) {
      return null
    }
    const name = await storeUpload(Buffer.from(file), path!.split('.').pop()!.toLowerCase())
    stored.push(name)
    return name
  }

  try {
    const db = useDb()
    const cover = await storeAsset(data.project.cover)

    // Tech stacks are matched by slug; missing ones are created.
    const slugs = data.techStacks.map(stack => stack.slug)
    const existing = slugs.length ? await db.select().from(tables.techStacks).where(inArray(tables.techStacks.slug, slugs)) : []
    const stackIds = new Map(existing.map(stack => [stack.slug, stack.id]))
    const missing = data.techStacks.filter(stack => !stackIds.has(stack.slug))
    const missingRows = await Promise.all(missing.map(async ({ logo, ...stack }) => ({ ...stack, logo: await storeAsset(logo) })))

    return await db.transaction(async (tx) => {
      if (missingRows.length) {
        const created = await tx.insert(tables.techStacks).values(missingRows).returning()
        created.forEach(stack => stackIds.set(stack.slug, stack.id))
      }

      const [project] = await tx.insert(tables.projects).values({ ...data.project, groupId, cover }).returning()
      const projectId = project!.id

      const envIds = new Map<string, string>()
      for (const [index, env] of data.environments.entries()) {
        const [row] = await tx.insert(tables.environments).values({ projectId, name: env.name, isProduction: env.isProduction, sortOrder: index }).returning()
        envIds.set(env.ref, row!.id)
      }

      const appIds = new Map<string, string>()
      for (const [index, app] of data.apps.entries()) {
        const [row] = await tx.insert(tables.apps).values({
          projectId,
          name: app.name,
          description: app.description,
          platforms: app.platforms,
          notes: app.notes,
          sortOrder: index
        }).returning()
        const appId = row!.id
        appIds.set(app.ref, appId)

        const techStackIds = [...new Set(app.techStacks.map(slug => stackIds.get(slug)).filter(Boolean))] as string[]
        if (techStackIds.length) {
          await tx.insert(tables.appTechStacks).values(techStackIds.map(techStackId => ({ appId, techStackId })))
        }

        for (const deployment of app.deployments) {
          const environmentId = envIds.get(deployment.environment)
          if (!environmentId) {
            continue
          }
          const [dep] = await tx.insert(tables.deployments).values({
            appId,
            environmentId,
            url: deployment.url,
            branch: deployment.branch,
            notes: deployment.notes
          }).returning()
          const deploymentId = dep!.id

          if (deployment.releases.length) {
            await tx.insert(tables.releases).values(deployment.releases.map(release => ({ ...release, deploymentId })))
          }
          for (const [accountIndex, account] of deployment.accounts.entries()) {
            const [acc] = await tx.insert(tables.testAccounts).values({
              deploymentId,
              label: account.label,
              description: account.description,
              tags: account.tags,
              status: account.status,
              lastVerifiedAt: account.lastVerifiedAt ? new Date(account.lastVerifiedAt) : null,
              sortOrder: accountIndex
            }).returning()
            if (account.fields.length) {
              await tx.insert(tables.testAccountFields).values(account.fields.map((field, fieldIndex) => ({
                accountId: acc!.id,
                key: field.key,
                isSecret: field.isSecret,
                value: field.isSecret && field.value ? toLocal(field.value) : field.value,
                sortOrder: fieldIndex
              })))
            }
          }
          const envVars = new Map(deployment.envVars.map(envVar => [envVar.key, envVar.value]))
          if (envVars.size) {
            await tx.insert(tables.envVars).values([...envVars].map(([key, value], envIndex) => ({
              deploymentId,
              key,
              value: toLocal(value),
              sortOrder: envIndex
            })))
          }
        }
      }

      if (data.links.length) {
        await tx.insert(tables.links).values(data.links.map((link, index) => ({
          projectId,
          appId: link.app ? appIds.get(link.app) ?? null : null,
          type: link.type,
          label: link.label,
          url: link.url,
          sortOrder: index
        })))
      }

      // An item whose environment isn't in the file is skipped rather than shared by all.
      const infra = data.infra.flatMap(({ environment, ...item }) => {
        const environmentId = environment ? envIds.get(environment) : null
        return environmentId === undefined ? [] : [{ ...item, projectId, environmentId }]
      })
      if (infra.length) {
        await tx.insert(tables.infraItems).values(infra)
      }

      return { id: projectId }
    })
  } catch (error) {
    await Promise.all(stored.map(name => deleteUpload(name)))
    throw error
  }
}
