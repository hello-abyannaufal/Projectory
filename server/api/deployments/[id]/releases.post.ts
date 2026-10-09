export default defineEventHandler(async (event) => {
  const deploymentId = getIdParam(event)
  const deployment = await findDeployment(deploymentId)
  const input = await readInput(event, releaseInput)
  const [release] = await useDb().insert(tables.releases).values({ ...input, deploymentId }).returning()
  await touchProject(deployment.app.projectId)
  return release
})
