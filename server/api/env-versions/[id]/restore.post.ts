// Replaces the deployment's .env with this version's values.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const version = await findEnvVersion(id)
  const deployment = await findDeployment(version.deploymentId)
  assertNotProduction(deployment)
  await withEnvHistory(event, version.deploymentId, 'restore', () =>
    applyEnvVars(version.deploymentId, decryptEnvVersion(version.content), { skip: [], replace: true }))
  await touchProject(deployment.app.projectId)
  await logAudit(event, { action: 'env.restore', ...await describeDeployment(version.deploymentId), metadata: { version: version.createdAt.toISOString() } })
  return { ok: true }
})
