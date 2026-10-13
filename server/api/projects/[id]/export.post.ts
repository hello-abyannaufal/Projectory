export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const input = await readInput(event, exportInput)
  if (input.secrets !== 'none' && !hasPermission((event.context.user as { role: string }).role, 'viewSecrets')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const tree = await loadProjectTree(id)
  const slug = tree.name.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
  setResponseHeader(event, 'Cache-Control', 'no-store')
  await logAudit(event, { action: 'project.export', ...await describeProject(id), metadata: { format: input.format, secrets: input.secrets } })

  if (input.format === 'markdown') {
    setResponseHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
    return buildProjectMarkdown(tree, input.secrets === 'plaintext')
  }

  const zip = await buildProjectZip(tree, input.secrets === 'passphrase' ? input.passphrase : undefined)
  setResponseHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${slug}.projectory.zip"`
  })
  return Buffer.from(zip)
})
