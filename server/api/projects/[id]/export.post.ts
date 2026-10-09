export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const input = await readInput(event, exportInput)
  const tree = await loadProjectTree(id)
  const slug = tree.name.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
  setResponseHeader(event, 'Cache-Control', 'no-store')

  if (input.format === 'markdown') {
    setResponseHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
    return buildProjectMarkdown(tree, input.secrets === 'plaintext')
  }

  const zip = await buildProjectZip(tree, input.secrets === 'passphrase' ? input.passphrase : undefined)
  setResponseHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${slug}.biblodrive.zip"`
  })
  return Buffer.from(zip)
})
