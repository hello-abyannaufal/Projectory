// A private group belongs to its creator alone. A shared group needs the manageGroups permission.
export default defineEventHandler(async (event) => {
  const { accessCode, isPrivate, ...input } = await readInput(event, groupInput)
  const user = event.context.user as { id: string, role: string }
  if (!isPrivate && !hasPermission(user.role, 'manageGroups')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const [group] = await useDb().insert(tables.groups)
    .values(isPrivate
      ? { ...input, ownerId: user.id }
      : { ...input, accessCode: accessCode ? encryptSecret(accessCode) : null })
    .returning({ id: tables.groups.id })
  return group!
})
