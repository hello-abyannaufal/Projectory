import { and, eq, ilike, isNull, notInArray, or, sql } from 'drizzle-orm'
import * as z from 'zod'

const LIMIT = 8

const searchQuery = z.object({ q: z.string().trim().min(2).max(100) })

// Searches names, URLs, branches, account labels/tags/plain fields and .env keys.
// Secret values are never searched. Locked groups and the trash are left out.
export default defineEventHandler(async (event) => {
  const { q } = await getValidatedQuery(event, query => searchQuery.parse(query))
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`
  const locked = [...await lockedGroupIds(event)]
  const db = useDb()
  const { groups, projects, apps, environments, deployments, links, testAccounts, testAccountFields, envVars } = tables
  const visible = and(isNull(projects.deletedAt), locked.length ? notInArray(projects.groupId, locked) : undefined)
  const deploymentScope = {
    deploymentId: deployments.id,
    projectId: projects.id,
    projectName: projects.name,
    appName: apps.name,
    environmentName: environments.name
  }

  const [projectRows, appRows, deploymentRows, accountRows, linkRows, envRows] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, description: projects.description, groupName: groups.name }).from(projects)
      .innerJoin(groups, eq(groups.id, projects.groupId))
      .where(and(visible, or(ilike(projects.name, pattern), ilike(projects.description, pattern))))
      .limit(LIMIT),
    db.select({ id: apps.id, name: apps.name, projectId: projects.id, projectName: projects.name }).from(apps)
      .innerJoin(projects, eq(projects.id, apps.projectId))
      .where(and(visible, ilike(apps.name, pattern)))
      .limit(LIMIT),
    db.select({ url: deployments.url, branch: deployments.branch, ...deploymentScope }).from(deployments)
      .innerJoin(apps, eq(apps.id, deployments.appId))
      .innerJoin(environments, eq(environments.id, deployments.environmentId))
      .innerJoin(projects, eq(projects.id, apps.projectId))
      .where(and(visible, or(ilike(deployments.url, pattern), ilike(deployments.branch, pattern))))
      .limit(LIMIT),
    db.select({ id: testAccounts.id, label: testAccounts.label, tags: testAccounts.tags, ...deploymentScope }).from(testAccounts)
      .innerJoin(deployments, eq(deployments.id, testAccounts.deploymentId))
      .innerJoin(apps, eq(apps.id, deployments.appId))
      .innerJoin(environments, eq(environments.id, deployments.environmentId))
      .innerJoin(projects, eq(projects.id, apps.projectId))
      .where(and(visible, or(
        ilike(testAccounts.label, pattern),
        sql`array_to_string(${testAccounts.tags}, ' ') ilike ${pattern}`,
        sql`exists (select 1 from ${testAccountFields} where ${testAccountFields.accountId} = ${testAccounts.id} and not ${testAccountFields.isSecret} and ${testAccountFields.value} ilike ${pattern})`
      )))
      .limit(LIMIT),
    db.select({ id: links.id, label: links.label, url: links.url, projectId: projects.id, projectName: projects.name }).from(links)
      .innerJoin(projects, eq(projects.id, links.projectId))
      .where(and(visible, or(ilike(links.label, pattern), ilike(links.url, pattern))))
      .limit(LIMIT),
    db.select({ key: envVars.key, ...deploymentScope }).from(envVars)
      .innerJoin(deployments, eq(deployments.id, envVars.deploymentId))
      .innerJoin(apps, eq(apps.id, deployments.appId))
      .innerJoin(environments, eq(environments.id, deployments.environmentId))
      .innerJoin(projects, eq(projects.id, apps.projectId))
      .where(and(visible, ilike(envVars.key, pattern)))
      .limit(LIMIT)
  ])

  const deploymentPath = (row: { projectId: string, deploymentId: string }) => `/projects/${row.projectId}/deployments/${row.deploymentId}`
  const deploymentName = (row: { projectName: string, appName: string, environmentName: string }) => `${row.projectName} / ${row.appName} / ${row.environmentName}`

  return {
    projects: projectRows.map(row => ({ id: row.id, label: row.name, description: row.description ?? row.groupName, to: `/projects/${row.id}` })),
    apps: appRows.map(row => ({ id: row.id, label: row.name, description: row.projectName, to: `/projects/${row.projectId}` })),
    deployments: deploymentRows.map(row => ({ id: row.deploymentId, label: deploymentName(row), description: [row.url, row.branch].filter(Boolean).join(' · '), to: deploymentPath(row) })),
    accounts: accountRows.map(row => ({ id: row.id, label: row.label, description: [deploymentName(row), row.tags.join(', ')].filter(Boolean).join(' · '), to: deploymentPath(row) })),
    links: linkRows.map(row => ({ id: row.id, label: row.label, description: `${row.projectName} · ${row.url}`, to: row.url, external: true })),
    envKeys: envRows.map(row => ({ id: `${row.deploymentId}-${row.key}`, label: row.key, description: deploymentName(row), to: deploymentPath(row) }))
  }
})
