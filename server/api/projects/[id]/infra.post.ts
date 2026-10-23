export default defineEventHandler(async (event) => {
  const projectId = getIdParam(event)
  await requireProject(projectId)
  const input = await readInput(event, infraInput)
  await assertProjectEnvironment(projectId, input.environmentId)
  const [item] = await useDb().insert(tables.infraItems).values({ ...input, projectId }).returning()
  await touchProject(projectId)
  return item
})
