import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'
import type { Role } from './constants'

// Better Auth admin plugin roles: only the super user may manage users.
export const authAccessControl = createAccessControl(defaultStatements)

export const authRoles = {
  super_user: adminAc,
  maintainer: authAccessControl.newRole({ user: [], session: [] }),
  viewer: authAccessControl.newRole({ user: [], session: [] })
} satisfies Record<Role, unknown>
