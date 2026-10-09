export default defineEventHandler(async (event) => {
  const file = await readUpload(getRouterParam(event, 'name') ?? '')
  if (!file) {
    notFound()
  }
  setResponseHeaders(event, {
    'Content-Type': file.type,
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    // SVGs may contain scripts; never let an uploaded file run anything.
    'Content-Security-Policy': 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox'
  })
  return file.data
})
