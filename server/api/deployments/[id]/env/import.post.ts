// Previews (apply: false) or applies .env content to a deployment.
export default defineEventHandler(async (event) => {
  const deploymentId = getIdParam(event)
  const deployment = await findDeployment(deploymentId)
  assertNotProduction(deployment)
  const { content, apply, skip, replace } = await readInput(event, envImportInput)
  const incoming = parseDotenv(content).filter(entry => ENV_KEY_PATTERN.test(entry.key))

  if (!apply) {
    const diff = diffEnvVars(await readEnvVars(deploymentId), incoming)
    return replace ? diff : { ...diff, removed: [] }
  }

  const diff = await applyEnvVars(deploymentId, incoming, { skip, replace })
  await touchProject(deployment.app.projectId)
  return replace ? diff : { ...diff, removed: [] }
})
