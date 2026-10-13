export const PROJECT_STATUSES = ['active', 'maintenance', 'on_hold', 'archived'] as const
export type ProjectStatus = typeof PROJECT_STATUSES[number]

export const LINK_TYPES = ['repository', 'mockup', 'docs', 'api_docs', 'ci_cd', 'issue_tracker', 'other'] as const
export type LinkType = typeof LINK_TYPES[number]

export const PLATFORMS = ['web', 'android', 'ios', 'desktop', 'backend', 'other'] as const
export type Platform = typeof PLATFORMS[number]

export const TECH_CATEGORIES = ['frontend', 'backend', 'mobile', 'database', 'devops', 'other'] as const
export type TechCategory = typeof TECH_CATEGORIES[number]

export const RELEASE_TYPES = [
  'web_url',
  'play_store',
  'app_store',
  'testflight',
  'firebase_distribution',
  'build_file',
  'docker_image',
  'package',
  'other'
] as const
export type ReleaseType = typeof RELEASE_TYPES[number]

export const RELEASE_STATUSES = ['draft', 'released', 'rolled_back'] as const
export type ReleaseStatus = typeof RELEASE_STATUSES[number]

export const TEST_ACCOUNT_STATUSES = ['active', 'locked', 'expired'] as const
export type TestAccountStatus = typeof TEST_ACCOUNT_STATUSES[number]

// Shown instead of a secret value until it is revealed.
export const SECRET_MASK = '••••••••'

export const ROLES = ['super_user', 'maintainer', 'viewer'] as const
export type Role = typeof ROLES[number]

// Events recorded in the audit log (server/utils/audit.ts).
export const AUDIT_ACTIONS = [
  'user.sign_in',
  'user.create',
  'user.role_change',
  'user.password_reset',
  'user.delete',
  'account.reveal',
  'env.reveal',
  'project.export',
  'project.import',
  'project.delete',
  'project.restore',
  'project.purge',
  'group.unlock',
  'group.unlock_failed',
  'group.access_code_view',
  'group.access_code_change',
  'group.delete'
] as const
export type AuditAction = typeof AUDIT_ACTIONS[number]

// Signed out after this long without keyboard, mouse or touch input.
export const IDLE_TIMEOUT_MS = 60 * 60 * 1000

// A test account not verified for this long is flagged for a re-check.
export const STALE_ACCOUNT_DAYS = 30

// Deleted projects stay restorable in the trash this long.
export const TRASH_RETENTION_DAYS = 30
