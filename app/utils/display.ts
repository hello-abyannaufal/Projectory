type BadgeColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

export const projectStatusColor: Record<ProjectStatus, BadgeColor> = {
  active: 'success',
  maintenance: 'info',
  on_hold: 'warning',
  archived: 'neutral'
}

export const releaseStatusColor: Record<ReleaseStatus, BadgeColor> = {
  draft: 'neutral',
  released: 'success',
  rolled_back: 'error'
}

export const testAccountStatusColor: Record<TestAccountStatus, BadgeColor> = {
  active: 'success',
  locked: 'warning',
  expired: 'error'
}

// jsonb columns come back untyped; the editor expects a TipTap doc or null.
export function asDoc(value: unknown) {
  return (value ?? null) as Record<string, unknown> | null
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : name.slice(0, 2)
  return letters.toUpperCase()
}

export function uploadUrl(name: string | null | undefined) {
  return name ? `/uploads/${name}` : undefined
}

export function timeAgo(value: string | Date, locale: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60]
  ]
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return rtf.format(Math.round(seconds / size), unit)
    }
  }
  return rtf.format(0, 'minute')
}

// Destructive or failed actions stand out from routine ones.
export function auditActionColor(action: string): BadgeColor {
  if (action.endsWith('delete') || action.endsWith('purge') || action.endsWith('failed')) {
    return 'error'
  }
  if (action.endsWith('reveal') || action.startsWith('group.access_code') || action === 'project.export') {
    return 'warning'
  }
  return 'neutral'
}

export const infraTypeIcon: Record<InfraType, string> = {
  server: 'i-lucide-server',
  kubernetes: 'i-lucide-ship-wheel',
  database: 'i-lucide-database',
  vpn: 'i-lucide-shield',
  registry: 'i-lucide-package',
  other: 'i-lucide-box'
}

// Only http(s) hosts are rendered as links.
export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}
