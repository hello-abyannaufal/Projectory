import * as z from 'zod'

const MAX_BYTES = 50 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file')
  const passphrase = form?.find(part => part.name === 'passphrase')?.data.toString('utf8') || undefined
  const groupId = form?.find(part => part.name === 'groupId')?.data.toString('utf8') ?? ''
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_FILE' })
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'File too large' })
  }
  if (!z.uuid().safeParse(groupId).success) {
    throw createError({ statusCode: 400, statusMessage: 'Group not found' })
  }
  await requireGroup(groupId)
  await assertGroupOpen(event, groupId)
  const project = await importProjectZip(new Uint8Array(file.data), groupId, passphrase)
  await logAudit(event, { action: 'project.import', ...await describeProject(project.id), metadata: { withSecrets: !!passphrase } })
  return project
})
