export default defineEventHandler(async (event) => {
  const input = await readInput(event, projectInput)
  await requireGroup(input.groupId)
  await assertGroupOpen(event, input.groupId)
  const [project] = await useDb().insert(tables.projects).values(input).returning()
  return project!
})
