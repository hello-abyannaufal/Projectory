import * as z from 'zod'

const input = z.object({
  slug: z.string(),
  category: z.enum(TECH_CATEGORIES).default('other')
})

export default defineEventHandler(async (event) => {
  const { slug, category } = await readInput(event, input)
  const icon = findSimpleIcon(slug)
  if (!icon) {
    notFound()
  }
  const [stack] = await useDb().insert(tables.techStacks)
    .values({ name: icon.title, slug: icon.slug, color: icon.hex, simpleIcon: icon.slug, category })
    .onConflictDoNothing({ target: tables.techStacks.slug })
    .returning()
  return stack ?? { ok: true }
})
