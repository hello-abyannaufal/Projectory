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
