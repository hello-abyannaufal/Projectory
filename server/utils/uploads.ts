import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { del, get, put } from '@vercel/blob'
import type { H3Event } from 'h3'

const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
}

const CONTENT_TYPES = Object.fromEntries(Object.entries(IMAGE_TYPES).map(([type, ext]) => [ext, type]))

const MAX_BYTES = 2 * 1024 * 1024

function uploadDir() {
  return resolve(useRuntimeConfig().uploadDir)
}

// Serverless filesystems are ephemeral, so on Vercel uploads go to Blob storage.
// Locally (and in Docker) there's no token and files stay in uploadDir.
function useBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

// Reads the `file` field of a multipart request and stores it under a random name.
export async function saveImageUpload(event: H3Event) {
  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file')
  const ext = file?.type ? IMAGE_TYPES[file.type] : undefined
  if (!file || !ext) {
    throw createError({ statusCode: 400, statusMessage: 'Upload a PNG, JPG, WEBP or SVG image' })
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Image must be 2 MB or smaller' })
  }
  return storeUpload(file.data, ext)
}

export async function storeUpload(data: Buffer, ext: string) {
  const name = `${randomUUID()}.${ext}`
  if (useBlob()) {
    await put(name, data, { access: 'private', addRandomSuffix: false, contentType: CONTENT_TYPES[ext] })
    return name
  }
  await mkdir(uploadDir(), { recursive: true })
  await writeFile(join(uploadDir(), name), data)
  return name
}

export async function readUpload(name: string) {
  const safe = basename(name)
  const ext = safe.split('.').pop() ?? ''
  const type = CONTENT_TYPES[ext]
  if (!type) {
    return null
  }
  try {
    if (useBlob()) {
      const blob = await get(safe, { access: 'private' })
      return blob?.stream ? { data: Buffer.from(await new Response(blob.stream).arrayBuffer()), type, ext } : null
    }
    return { data: await readFile(join(uploadDir(), safe)), type, ext }
  } catch {
    return null
  }
}

export async function deleteUpload(name: string | null | undefined) {
  if (name && useBlob()) {
    await del(basename(name))
  } else if (name) {
    await rm(join(uploadDir(), basename(name)), { force: true })
  }
}
