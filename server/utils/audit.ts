import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'

interface AuditEntry {
  action: AuditAction
  target?: string | null
  projectId?: string | null
  metadata?: Record<string, unknown>
}

// Records an action by the signed-in user. A failed write is logged and never
// fails the request itself.
export async function logAudit(event: H3Event, entry: AuditEntry) {
  const user = event.context.user as { id: string, name: string } | undefined
  if (user) {
    await writeAuditLog(user, entry, getRequestIP(event, { xForwardedFor: true }))
  }
}

export async function writeAuditLog(user: { id: string, name: string }, entry: AuditEntry, ipAddress?: string | null) {
  try {
    await useDb().insert(tables.auditLogs).values({
      userId: user.id,
      userName: user.name,
      action: entry.action,
      target: entry.target ?? null,
      projectId: entry.projectId ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: ipAddress ?? null
    })
  } catch (error) {
    console.error('Failed to write audit log', error)
  }
}

export async function describeProject(projectId: string) {
  const project = await useDb().query.projects.findFirst({
    where: eq(tables.projects.id, projectId),
    columns: { name: true },
    with: { group: { columns: { name: true } } }
  })
  return { projectId, target: project ? `${project.group.name} / ${project.name}` : null }
}

export async function describeDeployment(deploymentId: string) {
  const deployment = await useDb().query.deployments.findFirst({
    where: eq(tables.deployments.id, deploymentId),
    columns: { id: true },
    with: {
      environment: { columns: { name: true } },
      app: { columns: { name: true }, with: { project: { columns: { id: true, name: true } } } }
    }
  })
  if (!deployment) {
    return { projectId: null, target: null }
  }
  const { app, environment } = deployment
  return { projectId: app.project.id, target: `${app.project.name} / ${app.name} / ${environment.name}` }
}

export async function describeGroup(groupId: string) {
  const group = await useDb().query.groups.findFirst({ where: eq(tables.groups.id, groupId), columns: { name: true } })
  return group?.name ?? null
}
