export default defineEventHandler(async (event) => {
  const input = await readInput(event, projectInput)
  const [project] = await useDb().insert(tables.projects).values(input).returning()
  return project!
})
