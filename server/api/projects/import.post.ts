const MAX_BYTES = 50 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file')
  const passphrase = form?.find(part => part.name === 'passphrase')?.data.toString('utf8') || undefined
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_FILE' })
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'File too large' })
  }
  return importProjectZip(new Uint8Array(file.data), passphrase)
})
