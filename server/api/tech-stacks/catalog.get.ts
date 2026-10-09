import * as z from 'zod'

const query = z.object({ q: z.string().trim().max(60).default('') })

// Searches the bundled Simple Icons catalog.
export default defineEventHandler(async (event) => {
  const { q } = await getValidatedQuery(event, data => query.parse(data))
  const term = q.toLowerCase()
  if (!term) {
    return []
  }
  const existing = new Set((await useDb().select({ slug: tables.techStacks.slug }).from(tables.techStacks)).map(row => row.slug))
  return simpleIcons
    .filter(icon => icon.title.toLowerCase().includes(term) || icon.slug.includes(term))
    .sort((a, b) => Number(!a.title.toLowerCase().startsWith(term)) - Number(!b.title.toLowerCase().startsWith(term)))
    .slice(0, 30)
    .map(icon => ({ ...icon, added: existing.has(icon.slug) }))
})
