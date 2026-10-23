export default defineEventHandler(async (event) => {
  const deploymentId = getIdParam(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const vars = await readEnvVars(deploymentId)
  await logAudit(event, { action: 'env.reveal', ...await describeDeployment(deploymentId) })
  return vars.map(({ id, key, value }) => ({ id, key, value }))
})
