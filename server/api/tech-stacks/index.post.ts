import { like } from 'drizzle-orm'

function slugify(name: string) {
  return name.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'stack'
}

// Custom stacks get a `custom-` slug so they never collide with Simple Icons.
export default defineEventHandler(async (event) => {
  const input = await readInput(event, techStackInput)
  const db = useDb()
  const base = `custom-${slugify(input.name)}`
  const taken = new Set((await db.select({ slug: tables.techStacks.slug }).from(tables.techStacks).where(like(tables.techStacks.slug, `${base}%`))).map(row => row.slug))
  let slug = base
  for (let i = 2; taken.has(slug); i++) {
    slug = `${base}-${i}`
  }
  const [stack] = await db.insert(tables.techStacks).values({ ...input, slug, isCustom: true }).returning()
  return stack!
})
