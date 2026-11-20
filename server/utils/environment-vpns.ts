import { and, eq, inArray } from 'drizzle-orm'

// Replaces the VPNs an environment is reached through. They have to belong to
// the group of the environment's project.
export async function setEnvironmentVpns(environmentId: string, projectId: string, vpnIds: string[]) {
  const db = useDb()
  const ids = [...new Set(vpnIds)]
  const project = await db.query.projects.findFirst({ where: eq(tables.projects.id, projectId), columns: { groupId: true } })
  if (!project) {
    notFound()
  }
  if (ids.length) {
    const valid = await db.select({ id: tables.groupVpns.id }).from(tables.groupVpns)
      .where(and(eq(tables.groupVpns.groupId, project.groupId), inArray(tables.groupVpns.id, ids)))
    if (valid.length !== ids.length) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid VPN' })
    }
  }
  await db.delete(tables.environmentVpns).where(eq(tables.environmentVpns.environmentId, environmentId))
  if (ids.length) {
    await db.insert(tables.environmentVpns).values(ids.map(vpnId => ({ environmentId, vpnId })))
  }
}
