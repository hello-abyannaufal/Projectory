import { createHash, timingSafeEqual } from 'node:crypto'
import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm'
import type { H3Event } from 'h3'

function sessionOf(event: H3Event) {
  return event.context as { user: { id: string, role: string }, session: { id: string } }
}

// Private groups of other users. They don't exist as far as this user can tell,
// whatever their role.
export async function hiddenGroupIds(event: H3Event) {
  const { user } = sessionOf(event)
  const { groups } = tables
  const rows = await useDb().select({ id: groups.id }).from(groups)
    .where(and(isNotNull(groups.ownerId), ne(groups.ownerId, user.id)))
  return new Set(rows.map(row => row.id))
}

// Groups whose contents this session may not open: other users' private groups,
// and groups with an access code it hasn't entered yet (never for a super user).
export async function lockedGroupIds(event: H3Event) {
  const { user, session } = sessionOf(event)
  const locked = await hiddenGroupIds(event)
  if (hasPermission(user.role, 'manageGroups')) {
    return locked
  }
  const { groups, groupUnlocks } = tables
  const rows = await useDb().select({ id: groups.id }).from(groups)
    .leftJoin(groupUnlocks, and(eq(groupUnlocks.groupId, groups.id), eq(groupUnlocks.sessionId, session.id)))
    .where(and(isNotNull(groups.accessCode), isNull(groupUnlocks.groupId)))
  for (const row of rows) {
    locked.add(row.id)
  }
  return locked
}

export async function assertGroupOpen(event: H3Event, groupId: string) {
  if ((await hiddenGroupIds(event)).has(groupId)) {
    notFound()
  }
  if ((await lockedGroupIds(event)).has(groupId)) {
    throw createError({ statusCode: 403, statusMessage: 'GROUP_LOCKED' })
  }
}

// A group the user may create, change or delete: their own private group, or a
// shared group when they manage groups. Anyone else's private group is not found.
export async function requireManageableGroup(event: H3Event, groupId: string) {
  const { user } = sessionOf(event)
  const group = await useDb().query.groups.findFirst({
    where: eq(tables.groups.id, groupId),
    columns: { id: true, name: true, ownerId: true }
  })
  if (!group || (group.ownerId && group.ownerId !== user.id)) {
    notFound()
  }
  if (!group.ownerId && !hasPermission(user.role, 'manageGroups')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return group
}

export function accessCodeMatches(stored: string, input: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(decryptSecret(stored)), digest(input))
}

const ENTITY_PATH = /^\/api\/(projects|apps|environments|links|infra|deployments|releases|app-files|env-files|env-vars|env-versions|accounts)\/([0-9a-f-]{36})(?:\/|$)/i

// The project a /api/<entity>/<id> route belongs to, if any: its group, and
// whether it is in the trash.
export async function projectScopeForPath(path: string) {
  const match = ENTITY_PATH.exec(path)
  if (!match) {
    return undefined
  }
  const [, kind, id] = match as unknown as [string, string, string]
  const db = useDb()
  const { projects, apps, environments, links, infraItems, deployments, releases, appFiles, envFiles, envVars, envVarVersions, testAccounts } = tables
  const scope = { groupId: projects.groupId, deletedAt: projects.deletedAt }

  const byProject = (table: typeof environments | typeof links | typeof infraItems | typeof apps) =>
    db.select(scope).from(table)
      .innerJoin(projects, eq(projects.id, table.projectId))
      .where(eq(table.id, id))

  const byDeployment = (table: typeof releases | typeof envFiles | typeof envVars | typeof envVarVersions | typeof testAccounts) =>
    db.select(scope).from(table)
      .innerJoin(deployments, eq(deployments.id, table.deploymentId))
      .innerJoin(apps, eq(apps.id, deployments.appId))
      .innerJoin(projects, eq(projects.id, apps.projectId))
      .where(eq(table.id, id))

  if (kind.toLowerCase() === 'group-vpns') {
    const [row] = await db.select({ groupId: tables.groupVpns.groupId }).from(tables.groupVpns).where(eq(tables.groupVpns.id, id))
    return row && { groupId: row.groupId, trashed: false }
  }

  const query = {
    'projects': () => db.select(scope).from(projects).where(eq(projects.id, id)),
    'apps': () => byProject(apps),
    'environments': () => byProject(environments),
    'links': () => byProject(links),
    'infra': () => byProject(infraItems),
    'deployments': () => db.select(scope).from(deployments)
      .innerJoin(apps, eq(apps.id, deployments.appId))
      .innerJoin(projects, eq(projects.id, apps.projectId))
      .where(eq(deployments.id, id)),
    'releases': () => byDeployment(releases),
    'app-files': () => db.select(scope).from(appFiles)
      .innerJoin(apps, eq(apps.id, appFiles.appId))
      .innerJoin(projects, eq(projects.id, apps.projectId))
      .where(eq(appFiles.id, id)),
    'env-files': () => byDeployment(envFiles),
    'env-vars': () => byDeployment(envVars),
    'env-versions': () => byDeployment(envVarVersions),
    'accounts': () => byDeployment(testAccounts)
  }[kind.toLowerCase()]

  const [row] = await query!()
  return row && { groupId: row.groupId, trashed: !!row.deletedAt }
}

// Removes a user's private groups with everything in them, covers included.
export async function deletePrivateGroups(userId: string) {
  const db = useDb()
  const { groups, projects } = tables
  const owned = await db.select({ id: groups.id }).from(groups).where(eq(groups.ownerId, userId))
  for (const { id } of owned) {
    const removed = await db.delete(projects).where(eq(projects.groupId, id)).returning({ cover: projects.cover })
    for (const { cover } of removed) {
      await deleteUpload(cover)
    }
    await db.delete(groups).where(eq(groups.id, id))
  }
}
