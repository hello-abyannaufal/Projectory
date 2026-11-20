import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const file = await useDb().query.appFiles.findFirst({
    where: eq(tables.appFiles.id, id),
    with: { app: { columns: { name: true, projectId: true } } }
  })
  if (!file) {
    notFound()
  }
  await logAudit(event, { action: 'app_file.reveal', ...await describeProject(file.app.projectId), metadata: { app: file.app.name, file: file.path } })
  return { id: file.id, path: file.path, content: decryptSecret(file.content) }
})
