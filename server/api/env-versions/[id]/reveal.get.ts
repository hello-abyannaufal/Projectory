import { and, desc, eq, lt } from 'drizzle-orm'

// A version's values and those of the version before it, for a side-by-side diff.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const version = await findEnvVersion(id)
  const previous = await useDb().query.envVarVersions.findFirst({
    where: and(eq(tables.envVarVersions.deploymentId, version.deploymentId), lt(tables.envVarVersions.createdAt, version.createdAt)),
    orderBy: desc(tables.envVarVersions.createdAt)
  })
  await logAudit(event, { action: 'env.reveal', ...await describeDeployment(version.deploymentId), metadata: { version: version.createdAt.toISOString() } })
  return {
    entries: decryptEnvVersion(version.content),
    previous: previous ? decryptEnvVersion(previous.content) : []
  }
})
