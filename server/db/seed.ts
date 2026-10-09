import { techStacks } from './schema'

type Category = typeof techStacks.$inferInsert['category']

// Popular stacks available out of the box. Slugs that don't exist in
// the installed simple-icons version are skipped.
const BUILT_IN: Record<NonNullable<Category>, string[]> = {
  frontend: ['nuxt', 'vuedotjs', 'react', 'nextdotjs', 'angular', 'svelte', 'typescript', 'javascript', 'tailwindcss', 'vite', 'html5', 'css'],
  backend: ['nodedotjs', 'express', 'nestjs', 'springboot', 'laravel', 'php', 'python', 'django', 'fastapi', 'go', 'dotnet', 'rubyonrails', 'graphql', 'openjdk'],
  mobile: ['flutter', 'dart', 'kotlin', 'swift', 'android', 'ios', 'expo', 'electron'],
  database: ['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'sqlite', 'firebase', 'supabase', 'drizzle', 'prisma'],
  devops: ['docker', 'kubernetes', 'githubactions', 'gitlab', 'jenkins', 'nginx', 'vercel', 'cloudflare', 'googlecloud', 'linux'],
  other: []
}

export async function seedTechStacks() {
  const rows = Object.entries(BUILT_IN).flatMap(([category, slugs]) =>
    slugs.flatMap((slug) => {
      const icon = findSimpleIcon(slug)
      return icon
        ? [{ name: icon.title, slug: icon.slug, color: icon.hex, simpleIcon: icon.slug, category: category as Category, isCustom: false }]
        : []
    })
  )
  if (rows.length) {
    await useDb().insert(techStacks).values(rows).onConflictDoNothing({ target: techStacks.slug })
  }
}
