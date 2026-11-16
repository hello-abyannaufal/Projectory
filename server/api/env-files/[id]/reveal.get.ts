export default defineEventHandler(async (event) => {
  const file = await findEnvFile(getIdParam(event))
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const vars = await readEnvVars(file.id)
  await logAudit(event, { action: 'env.reveal', ...await describeDeployment(file.deploymentId), metadata: { file: file.path } })
  return vars.map(({ id, key, value }) => ({ id, key, value }))
})
