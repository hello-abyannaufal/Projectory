import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const group = await requireManageableGroup(event, id)
  // Who owns a group never changes, and a private group has no access code.
  const { accessCode, isPrivate: _isPrivate, ...input } = await readPatch(event, groupInput.partial())
  const codeChanged = accessCode !== undefined && !group.ownerId
  const db = useDb()
  await db.update(tables.groups)
    .set({ ...input, ...(codeChanged && { accessCode: accessCode ? encryptSecret(accessCode) : null }) })
    .where(eq(tables.groups.id, id))
  // A new code locks the group again for everyone who entered the old one.
  if (codeChanged) {
    await db.delete(tables.groupUnlocks).where(eq(tables.groupUnlocks.groupId, id))
    await logAudit(event, { action: 'group.access_code_change', target: await describeGroup(id), metadata: { removed: !accessCode } })
  }
  return { id }
})
