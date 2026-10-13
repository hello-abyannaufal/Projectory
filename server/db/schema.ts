import { relations } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core'
import {
  LINK_TYPES,
  PLATFORMS,
  PROJECT_STATUSES,
  RELEASE_STATUSES,
  RELEASE_TYPES,
  TECH_CATEGORIES,
  TEST_ACCOUNT_STATUSES
} from '../../shared/utils/constants'

// ---------------------------------------------------------------------------
// Auth (Better Auth core tables)
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  // Admin plugin fields; role is one of ROLES
  role: text('role').notNull().default('viewer'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  impersonatedBy: text('impersonated_by'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const projectStatus = pgEnum('project_status', PROJECT_STATUSES)

export const linkType = pgEnum('link_type', LINK_TYPES)

export const platform = pgEnum('platform', PLATFORMS)

export const techCategory = pgEnum('tech_category', TECH_CATEGORIES)

export const releaseType = pgEnum('release_type', RELEASE_TYPES)

export const releaseStatus = pgEnum('release_status', RELEASE_STATUSES)

export const testAccountStatus = pgEnum('test_account_status', TEST_ACCOUNT_STATUSES)

const timestamps = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date())
}

// ---------------------------------------------------------------------------
// Groups & projects
// ---------------------------------------------------------------------------

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  // Ciphertext (see server/utils/crypto.ts). When set, maintainers and viewers
  // must enter it once per session before they can open the group.
  accessCode: text('access_code'),
  ...timestamps
})

// Groups a session has unlocked with the access code.
export const groupUnlocks = pgTable('group_unlocks', {
  sessionId: text('session_id').notNull().references(() => session.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' })
}, t => [primaryKey({ columns: [t.sessionId, t.groupId] })])

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  // A group can only be deleted once it is empty.
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  description: text('description'),
  // Path of the uploaded cover/logo inside the upload dir
  cover: text('cover'),
  status: projectStatus('status').notNull().default('active'),
  // TipTap JSON
  notes: jsonb('notes'),
  // Set while the project is in the trash; purged after TRASH_RETENTION_DAYS.
  deletedAt: timestamp('deleted_at'),
  // Name of the user who moved it there
  deletedBy: text('deleted_by'),
  ...timestamps
}, t => [index('projects_group_idx').on(t.groupId)])

export const environments = pgTable('environments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isProduction: boolean('is_production').notNull().default(false),
  ...timestamps
}, t => [index('environments_project_idx').on(t.projectId)])

export const apps = pgTable('apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  platforms: platform('platforms').array().notNull().default([]),
  notes: jsonb('notes'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps
}, t => [index('apps_project_idx').on(t.projectId)])

// Project-level links have appId = null; app-level links have both set.
export const links = pgTable('links', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  appId: uuid('app_id').references(() => apps.id, { onDelete: 'cascade' }),
  type: linkType('type').notNull().default('other'),
  label: text('label').notNull(),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps
}, t => [index('links_project_idx').on(t.projectId), index('links_app_idx').on(t.appId)])

// ---------------------------------------------------------------------------
// Tech stacks
// ---------------------------------------------------------------------------

export const techStacks = pgTable('tech_stacks', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  category: techCategory('category').notNull().default('other'),
  // Hex without '#'
  color: text('color').notNull(),
  // Built-in stacks use the Simple Icons slug (rendered as i-simple-icons-<slug>)
  simpleIcon: text('simple_icon'),
  // Custom stacks may upload their own logo
  logo: text('logo'),
  isCustom: boolean('is_custom').notNull().default(false),
  ...timestamps
})

export const appTechStacks = pgTable('app_tech_stacks', {
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  techStackId: uuid('tech_stack_id').notNull().references(() => techStacks.id, { onDelete: 'restrict' })
}, t => [primaryKey({ columns: [t.appId, t.techStackId] })])

// ---------------------------------------------------------------------------
// Deployments (App × Environment)
// ---------------------------------------------------------------------------

export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  environmentId: uuid('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  url: text('url'),
  branch: text('branch'),
  notes: jsonb('notes'),
  ...timestamps
}, t => [unique('deployments_app_env_unique').on(t.appId, t.environmentId)])

export const releases = pgTable('releases', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
  type: releaseType('type').notNull().default('web_url'),
  version: text('version').notNull(),
  buildNumber: text('build_number'),
  url: text('url'),
  releasedAt: date('released_at'),
  changelog: text('changelog'),
  status: releaseStatus('status').notNull().default('released'),
  ...timestamps
}, t => [index('releases_deployment_idx').on(t.deploymentId)])

// Named "test accounts" to avoid clashing with Better Auth's `account` table.
export const testAccounts = pgTable('test_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  description: text('description'),
  tags: text('tags').array().notNull().default([]),
  status: testAccountStatus('status').notNull().default('active'),
  lastVerifiedAt: timestamp('last_verified_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps
}, t => [index('test_accounts_deployment_idx').on(t.deploymentId)])

export const testAccountFields = pgTable('test_account_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => testAccounts.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  // Plaintext when isSecret = false, ciphertext (see server/utils/crypto.ts) when true
  value: text('value').notNull().default(''),
  isSecret: boolean('is_secret').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0)
}, t => [index('test_account_fields_account_idx').on(t.accountId)])

export const envVars = pgTable('env_vars', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  // Always ciphertext
  value: text('value').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps
}, t => [unique('env_vars_deployment_key_unique').on(t.deploymentId, t.key)])

// ---------------------------------------------------------------------------
// Per-user project shortcuts
// ---------------------------------------------------------------------------

export const projectPins = pgTable('project_pins', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, t => [primaryKey({ columns: [t.userId, t.projectId] })])

// When each user last opened each project.
export const projectVisits = pgTable('project_visits', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  visitedAt: timestamp('visited_at').notNull().defaultNow()
}, t => [primaryKey({ columns: [t.userId, t.projectId] })])

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

// Who did what to which secret or security setting. Rows outlive the user and
// the target, so names are copied in rather than referenced.
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  userName: text('user_name').notNull(),
  // One of AUDIT_ACTIONS
  action: text('action').notNull(),
  // Readable path to the target, e.g. "Project / App / UAT / maker1"
  target: text('target'),
  projectId: uuid('project_id'),
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, t => [index('audit_logs_created_idx').on(t.createdAt), index('audit_logs_user_idx').on(t.userId)])

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const groupsRelations = relations(groups, ({ many }) => ({
  projects: many(projects)
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  group: one(groups, { fields: [projects.groupId], references: [groups.id] }),
  environments: many(environments),
  apps: many(apps),
  links: many(links)
}))

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, { fields: [environments.projectId], references: [projects.id] }),
  deployments: many(deployments)
}))

export const appsRelations = relations(apps, ({ one, many }) => ({
  project: one(projects, { fields: [apps.projectId], references: [projects.id] }),
  links: many(links),
  techStacks: many(appTechStacks),
  deployments: many(deployments)
}))

export const linksRelations = relations(links, ({ one }) => ({
  project: one(projects, { fields: [links.projectId], references: [projects.id] }),
  app: one(apps, { fields: [links.appId], references: [apps.id] })
}))

export const techStacksRelations = relations(techStacks, ({ many }) => ({
  apps: many(appTechStacks)
}))

export const appTechStacksRelations = relations(appTechStacks, ({ one }) => ({
  app: one(apps, { fields: [appTechStacks.appId], references: [apps.id] }),
  techStack: one(techStacks, { fields: [appTechStacks.techStackId], references: [techStacks.id] })
}))

export const deploymentsRelations = relations(deployments, ({ one, many }) => ({
  app: one(apps, { fields: [deployments.appId], references: [apps.id] }),
  environment: one(environments, { fields: [deployments.environmentId], references: [environments.id] }),
  releases: many(releases),
  testAccounts: many(testAccounts),
  envVars: many(envVars)
}))

export const releasesRelations = relations(releases, ({ one }) => ({
  deployment: one(deployments, { fields: [releases.deploymentId], references: [deployments.id] })
}))

export const testAccountsRelations = relations(testAccounts, ({ one, many }) => ({
  deployment: one(deployments, { fields: [testAccounts.deploymentId], references: [deployments.id] }),
  fields: many(testAccountFields)
}))

export const testAccountFieldsRelations = relations(testAccountFields, ({ one }) => ({
  account: one(testAccounts, { fields: [testAccountFields.accountId], references: [testAccounts.id] })
}))

export const envVarsRelations = relations(envVars, ({ one }) => ({
  deployment: one(deployments, { fields: [envVars.deploymentId], references: [deployments.id] })
}))
