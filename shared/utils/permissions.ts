import type { Role } from './constants'

// manageGroups / manageTechStacks / manageUsers / viewAuditLog: super user only.
// edit: create, change and delete projects and everything inside them.
// viewSecrets: reveal account passwords and .env values, export with secrets.
export type Permission = 'manageGroups' | 'manageTechStacks' | 'manageUsers' | 'viewAuditLog' | 'edit' | 'viewSecrets'

const PERMISSIONS: Record<Role, Permission[]> = {
  super_user: ['manageGroups', 'manageTechStacks', 'manageUsers', 'viewAuditLog', 'edit', 'viewSecrets'],
  maintainer: ['edit', 'viewSecrets'],
  viewer: []
}

export function hasPermission(role: string | null | undefined, permission: Permission) {
  return PERMISSIONS[role as Role]?.includes(permission) ?? false
}
