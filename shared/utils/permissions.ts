import type { Role } from './constants'

// manageGroups / manageTechStacks / manageUsers / viewAuditLog: master and super user only.
// edit: create, change and delete projects and everything inside them.
// viewSecrets: reveal account passwords and .env values, export with secrets.
export type Permission = 'manageGroups' | 'manageTechStacks' | 'manageUsers' | 'viewAuditLog' | 'edit' | 'viewSecrets'

const PERMISSIONS: Record<Role, Permission[]> = {
  master: ['manageGroups', 'manageTechStacks', 'manageUsers', 'viewAuditLog', 'edit', 'viewSecrets'],
  super_user: ['manageGroups', 'manageTechStacks', 'manageUsers', 'viewAuditLog', 'edit', 'viewSecrets'],
  maintainer: ['edit', 'viewSecrets'],
  viewer: []
}

// Roles whose accounts a role may create, change, reset or delete, and may hand
// out. There is one master, set at setup, and nobody can change it in the app
// (docs/SECURITY.md has the server-side transfer), so a super user can never
// lock the master out.
const MANAGEABLE_ROLES: Record<Role, Role[]> = {
  master: ['super_user', 'maintainer', 'viewer'],
  super_user: ['maintainer', 'viewer'],
  maintainer: [],
  viewer: []
}

export function canManageRole(role: string | null | undefined, target: string | null | undefined) {
  return MANAGEABLE_ROLES[role as Role]?.includes(target as Role) ?? false
}

export function hasPermission(role: string | null | undefined, permission: Permission) {
  return PERMISSIONS[role as Role]?.includes(permission) ?? false
}
