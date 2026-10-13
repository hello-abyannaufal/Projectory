import { createHash, timingSafeEqual } from 'node:crypto'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import type { H3Event } from 'h3'

function sessionOf(event: H3Event) {
  return event.context as { user: { role: string }, session: { id: string } }
}

// Groups with an access code this session hasn't entered yet. Always empty for a super user.
export async function lockedGroupIds(event: H3Event) {
  const { user, session } = sessionOf(event)
  if (hasPermission(user.role, 'manageGroups')) {
    return new Set<string>()
  }
  const { groups, groupUnlocks } = tables
  const rows = await useDb().select({ id: groups.id }).from(groups)
    .leftJoin(groupUnlocks, and(eq(groupUnlocks.groupId, groups.id), eq(groupUnlocks.sessionId, session.id)))
    .where(and(isNotNull(groups.accessCode), isNull(groupUnlocks.groupId)))
  return new Set(rows.map(row => row.id))
}

export async function assertGroupOpen(event: H3Event, groupId: string) {
  if ((await lockedGroupIds(event)).has(groupId)) {
    throw createError({ statusCode: 403, statusMessage: 'GROUP_LOCKED' })
  }
}

export function accessCodeMatches(stored: string, input: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(decryptSecret(stored)), digest(input))
}

const ENTITY_PATH = /^\/api\/(projects|apps|environments|links|deployments|releases|env-vars|env-versions|accounts)\/([0-9a-f-]{36})(?:\/|$)/i

// The project a /api/<entity>/<id> route belongs to, if any: its group, and
// whether it is in the trash.
export async function projectScopeForPath(path: string) {
  const match = ENTITY_PATH.exec(path)
  if (!match) {
    return undefined
  }
  const [, kind, id] = match as unknown as [string, string, string]
  const db = useDb()
  const { projects, apps, environments, links, deployments, releases, envVars, envVarVersions, testAccounts } = tables
  const scope = { groupId: projects.groupId, deletedAt: projects.deletedAt }

  const byProject = (table: typeof environments | typeof links | typeof apps) =>
    db.select(scope).from(table)
      .innerJoin(projects, eq(projects.id, table.projectId))
      .where(eq(table.id, id))

  const byDeployment = (table: typeof releases | typeof envVars | typeof envVarVersions | typeof testAccounts) =>
    db.select(scope).from(table)
      .innerJoin(deployments, eq(deployments.id, table.deploymentId))
      .innerJoin(apps, eq(apps.id, deployments.appId))
      .innerJoin(projects, eq(projects.id, apps.projectId))
      .where(eq(table.id, id))

  const query = {
    'projects': () => db.select(scope).from(projects).where(eq(projects.id, id)),
    'apps': () => byProject(apps),
    'environments': () => byProject(environments),
    'links': () => byProject(links),
    'deployments': () => db.select(scope).from(deployments)
      .innerJoin(apps, eq(apps.id, deployments.appId))
      .innerJoin(projects, eq(projects.id, apps.projectId))
      .where(eq(deployments.id, id)),
    'releases': () => byDeployment(releases),
    'env-vars': () => byDeployment(envVars),
    'env-versions': () => byDeployment(envVarVersions),
    'accounts': () => byDeployment(testAccounts)
  }[kind.toLowerCase()]

  const [row] = await query!()
  return row && { groupId: row.groupId, trashed: !!row.deletedAt }
}
