import * as z from 'zod'
import {
  LINK_TYPES,
  PLATFORMS,
  PROJECT_STATUSES,
  RELEASE_STATUSES,
  RELEASE_TYPES,
  TECH_CATEGORIES,
  TEST_ACCOUNT_STATUSES
} from './constants'

// Only http(s), so stored links can never be javascript: or data: URLs.
export const httpUrl = z.url({ protocol: /^https?$/ })

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform(v => v || null)

// TipTap document JSON
export const richText = z.object({ type: z.literal('doc') }).loose().nullish()

export const groupInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
  // Empty or null means anyone can open the group.
  accessCode: z.string().trim().min(4).max(64).nullish().or(z.literal('')).transform(v => v || null)
})

export const projectInput = z.object({
  groupId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
  status: z.enum(PROJECT_STATUSES).default('active')
})

export const projectPatch = projectInput.partial().extend({
  notes: richText
})

export const linkInput = z.object({
  type: z.enum(LINK_TYPES).default('other'),
  label: z.string().trim().min(1).max(120),
  url: httpUrl,
  appId: z.uuid().nullish()
})

export const environmentInput = z.object({
  name: z.string().trim().min(1).max(40),
  isProduction: z.boolean().default(false)
})

export const appInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
  techStackIds: z.array(z.uuid()).default([])
})

export const appPatch = appInput.partial().extend({
  notes: richText
})

export const deploymentInput = z.object({
  url: httpUrl.nullish().or(z.literal('')).transform(v => v || null),
  branch: optionalText(120),
  notes: richText
})

export const releaseInput = z.object({
  type: z.enum(RELEASE_TYPES).default('web_url'),
  version: z.string().trim().min(1).max(60),
  buildNumber: optionalText(60),
  url: httpUrl.nullish().or(z.literal('')).transform(v => v || null),
  releasedAt: z.iso.date().nullish().or(z.literal('')).transform(v => v || null),
  changelog: optionalText(5000),
  status: z.enum(RELEASE_STATUSES).default('released')
})

export const testAccountFieldInput = z.object({
  id: z.uuid().optional(),
  key: z.string().trim().min(1).max(60),
  // For an existing secret field, null keeps the stored value unchanged.
  value: z.string().max(2000).nullable(),
  isSecret: z.boolean().default(false)
})

export const testAccountInput = z.object({
  label: z.string().trim().min(1).max(120),
  description: optionalText(500),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  status: z.enum(TEST_ACCOUNT_STATUSES).default('active'),
  lastVerifiedAt: z.iso.datetime().nullish(),
  fields: z.array(testAccountFieldInput).max(30).default([])
})

export const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/

export const envVarInput = z.object({
  key: z.string().trim().regex(ENV_KEY_PATTERN).max(200),
  value: z.string().max(20000)
})

export const envImportInput = z.object({
  content: z.string().max(200000),
  // Without apply the request only returns the preview.
  apply: z.boolean().default(false),
  // Changed keys to leave untouched.
  skip: z.array(z.string()).default([]),
  // Delete stored keys that are missing from content (used by the raw editor).
  replace: z.boolean().default(false)
})

export const techStackInput = z.object({
  name: z.string().trim().min(1).max(60),
  category: z.enum(TECH_CATEGORIES).default('other'),
  color: z.string().regex(/^[0-9A-Fa-f]{6}$/)
})
