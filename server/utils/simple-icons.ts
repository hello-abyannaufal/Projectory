import icons from 'simple-icons/icons.json'

export interface SimpleIcon {
  title: string
  slug: string
  hex: string
}

export const simpleIcons: SimpleIcon[] = (icons as SimpleIcon[]).map(({ title, slug, hex }) => ({ title, slug, hex }))

const bySlug = new Map(simpleIcons.map(icon => [icon.slug, icon]))

export function findSimpleIcon(slug: string) {
  return bySlug.get(slug)
}
