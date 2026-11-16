// Replaces the .env file with this version's values.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const version = await findEnvVersion(id)
  const deployment = await findDeployment(version.deploymentId)
  assertNotProduction(deployment)
  const file = { id: version.envFileId, deploymentId: version.deploymentId }
  await withEnvHistory(event, file, 'restore', () =>
    applyEnvVars(file, decryptEnvVersion(version.content), { skip: [], replace: true }))
  await touchProject(deployment.app.projectId)
  await logAudit(event, { action: 'env.restore', ...await describeDeployment(version.deploymentId), metadata: { version: version.createdAt.toISOString() } })
  return { ok: true }
})
