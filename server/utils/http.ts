import * as z from 'zod'
import type { H3Event } from 'h3'

const uuid = z.uuid()

export function getIdParam(event: H3Event, name = 'id') {
  const value = getRouterParam(event, name)
  if (!uuid.safeParse(value).success) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return value as string
}

export function notFound(): never {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

export function readInput<T extends z.ZodType>(event: H3Event, schema: T) {
  return readValidatedBody(event, body => schema.parse(body)) as Promise<z.output<T>>
}

// Zod 4 still fills .default() values for keys a partial schema leaves out,
// which would overwrite stored data, so a patch keeps only the keys that were sent.
export async function readPatch<T extends z.ZodType>(event: H3Event, schema: T) {
  const data = await readInput(event, schema) as Record<string, unknown>
  const body = await readBody<Record<string, unknown>>(event)
  return Object.fromEntries(Object.entries(data).filter(([key]) => key in body)) as z.output<T>
}
