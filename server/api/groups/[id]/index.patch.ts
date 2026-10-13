import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const { accessCode, ...input } = await readPatch(event, groupInput.partial())
  const codeChanged = accessCode !== undefined
  const db = useDb()
  const [group] = await db.update(tables.groups)
    .set({ ...input, ...(codeChanged && { accessCode: accessCode ? encryptSecret(accessCode) : null }) })
    .where(eq(tables.groups.id, id))
    .returning({ id: tables.groups.id })
  if (!group) {
    notFound()
  }
  // A new code locks the group again for everyone who entered the old one.
  if (codeChanged) {
    await db.delete(tables.groupUnlocks).where(eq(tables.groupUnlocks.groupId, id))
  }
  return group
})
