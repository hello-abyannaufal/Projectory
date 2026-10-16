import { and, eq, like } from 'drizzle-orm'

// Super user only (see server/middleware/auth.ts). For a user who lost their
// authenticator: they set it up again at their next sign-in. Their sessions
// and trusted browsers go too, in case the device was stolen.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  if (id === (event.context.user as { id: string }).id) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot reset your own two-factor' })
  }
  const { user, twoFactor, session, verification } = tables
  const db = useDb()
  const target = await db.query.user.findFirst({ where: eq(user.id, id), columns: { email: true } })
  if (!target) {
    notFound()
  }
  await db.transaction(async (tx) => {
    await tx.delete(twoFactor).where(eq(twoFactor.userId, id))
    await tx.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, id))
    await tx.delete(session).where(eq(session.userId, id))
    await tx.delete(verification).where(and(eq(verification.value, id), like(verification.identifier, 'trust-device-%')))
  })
  await logAudit(event, { action: 'user.two_factor_reset', target: target.email })
  return { ok: true }
})
