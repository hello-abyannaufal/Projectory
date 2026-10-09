import { randomBytes } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { strToU8, zipSync } from 'fflate'
import * as z from 'zod'

export const EXPORT_SCHEMA_VERSION = 1

export const exportInput = z.discriminatedUnion('format', [
  z.object({
    format: z.literal('zip'),
    secrets: z.enum(['none', 'passphrase']).default('none'),
    passphrase: z.string().min(8).optional()
  }).refine(input => input.secrets !== 'passphrase' || input.passphrase, { path: ['passphrase'] }),
  z.object({
    format: z.literal('markdown'),
    secrets: z.enum(['none', 'plaintext']).default('none')
  })
])

export async function loadProjectTree(projectId: string) {
  const project = await useDb().query.projects.findFirst({
    where: eq(tables.projects.id, projectId),
    with: {
      links: { orderBy: asc(tables.links.sortOrder) },
      environments: { orderBy: [asc(tables.environments.sortOrder), asc(tables.environments.createdAt)] },
      apps: {
        orderBy: [asc(tables.apps.sortOrder), asc(tables.apps.createdAt)],
        with: {
          techStacks: { with: { techStack: true } },
          deployments: {
            with: {
              releases: { orderBy: asc(tables.releases.createdAt) },
              testAccounts: {
                orderBy: asc(tables.testAccounts.sortOrder),
                with: { fields: { orderBy: asc(tables.testAccountFields.sortOrder) } }
              },
              envVars: { orderBy: [asc(tables.envVars.sortOrder), asc(tables.envVars.key)] }
            }
          }
        }
      }
    }
  })
  if (!project) {
    notFound()
  }
  return project
}

type ProjectTree = Awaited<ReturnType<typeof loadProjectTree>>

// Builds <project>.biblodrive.zip: project.json plus uploaded images under assets/.
export async function buildProjectZip(tree: ProjectTree, passphrase?: string) {
  const salt = randomBytes(16)
  const key = passphrase ? deriveKey(passphrase, salt) : undefined
  // Stored ciphertext (master key) -> portable form (passphrase) or empty.
  const secret = (stored: string) => key && stored ? encryptWithKey(decryptSecret(stored), key) : ''

  const assets: Record<string, Uint8Array> = {}
  const addAsset = async (name: string | null) => {
    if (!name) {
      return null
    }
    const file = await readUpload(name)
    if (!file) {
      return null
    }
    const path = `assets/${name}`
    assets[path] = file.data
    return path
  }

  const stacks = new Map(tree.apps.flatMap(app => app.techStacks.map(({ techStack }) => [techStack.slug, techStack])))

  const data = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    encryption: key ? { algorithm: 'aes-256-gcm', kdf: 'scrypt', salt: salt.toString('base64') } : null,
    project: {
      name: tree.name,
      description: tree.description,
      status: tree.status,
      notes: tree.notes,
      cover: await addAsset(tree.cover)
    },
    techStacks: await Promise.all([...stacks.values()].map(async stack => ({
      slug: stack.slug,
      name: stack.name,
      category: stack.category,
      color: stack.color,
      simpleIcon: stack.simpleIcon,
      isCustom: stack.isCustom,
      logo: await addAsset(stack.logo)
    }))),
    environments: tree.environments.map(env => ({ ref: env.id, name: env.name, isProduction: env.isProduction })),
    links: tree.links.map(link => ({ app: link.appId, type: link.type, label: link.label, url: link.url })),
    apps: tree.apps.map(app => ({
      ref: app.id,
      name: app.name,
      description: app.description,
      platforms: app.platforms,
      notes: app.notes,
      techStacks: app.techStacks.map(({ techStack }) => techStack.slug),
      deployments: app.deployments.map(deployment => ({
        environment: deployment.environmentId,
        url: deployment.url,
        branch: deployment.branch,
        notes: deployment.notes,
        releases: deployment.releases.map(({ type, version, buildNumber, url, releasedAt, changelog, status }) =>
          ({ type, version, buildNumber, url, releasedAt, changelog, status })),
        accounts: deployment.testAccounts.map(account => ({
          label: account.label,
          description: account.description,
          tags: account.tags,
          status: account.status,
          lastVerifiedAt: account.lastVerifiedAt?.toISOString() ?? null,
          fields: account.fields.map(field => ({
            key: field.key,
            isSecret: field.isSecret,
            value: field.isSecret ? secret(field.value) : field.value
          }))
        })),
        envVars: deployment.envVars.map(envVar => ({ key: envVar.key, value: secret(envVar.value) }))
      }))
    }))
  }

  return zipSync({ 'project.json': strToU8(JSON.stringify(data, null, 2)), ...assets })
}

// Human-readable summary for people without BibloDrive.
export function buildProjectMarkdown(tree: ProjectTree, withSecrets: boolean) {
  const reveal = (stored: string) => withSecrets && stored ? decryptSecret(stored) : SECRET_MASK
  const envName = new Map(tree.environments.map(env => [env.id, env]))
  const lines = [`# ${tree.name}`]
  if (tree.description) {
    lines.push('', tree.description)
  }
  const projectLinks = tree.links.filter(link => !link.appId)
  if (projectLinks.length) {
    lines.push('', '## Links', ...projectLinks.map(link => `- [${link.label}](${link.url})`))
  }
  for (const app of tree.apps) {
    lines.push('', `## ${app.name}`)
    const meta = [app.platforms.join(', '), app.techStacks.map(({ techStack }) => techStack.name).join(', ')].filter(Boolean)
    if (meta.length) {
      lines.push('', meta.join(' · '))
    }
    for (const link of tree.links.filter(item => item.appId === app.id)) {
      lines.push(`- [${link.label}](${link.url})`)
    }
    const deployments = [...app.deployments].sort((a, b) => (envName.get(a.environmentId)?.sortOrder ?? 0) - (envName.get(b.environmentId)?.sortOrder ?? 0))
    for (const deployment of deployments) {
      lines.push('', `### ${envName.get(deployment.environmentId)?.name ?? ''}`)
      if (deployment.url) {
        lines.push(`- URL: ${deployment.url}`)
      }
      if (deployment.branch) {
        lines.push(`- Branch: \`${deployment.branch}\``)
      }
      const latest = deployment.releases.at(-1)
      if (latest) {
        lines.push(`- Latest release: ${latest.version}`)
      }
      for (const account of deployment.testAccounts) {
        lines.push('', `**${account.label}**${account.tags.length ? ` (${account.tags.join(', ')})` : ''}`)
        for (const field of account.fields) {
          lines.push(`- ${field.key}: ${field.isSecret ? reveal(field.value) : field.value}`)
        }
      }
      if (deployment.envVars.length) {
        lines.push('', '```dotenv', ...deployment.envVars.map(envVar => `${envVar.key}=${reveal(envVar.value)}`), '```')
      }
    }
  }
  return `${lines.join('\n')}\n`
}
