export default defineEventHandler(async (event) => {
  const { accessCode, ...input } = await readInput(event, groupInput)
  const [group] = await useDb().insert(tables.groups)
    .values({ ...input, accessCode: accessCode ? encryptSecret(accessCode) : null })
    .returning({ id: tables.groups.id })
  return group!
})
