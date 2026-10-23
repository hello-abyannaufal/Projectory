import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'
import type { Role } from './constants'

// Better Auth admin plugin roles: only the master and super users may manage
// users. Which users each may touch is checked in server/utils/auth.ts.
export const authAccessControl = createAccessControl(defaultStatements)

export const authRoles = {
  master: adminAc,
  super_user: adminAc,
  maintainer: authAccessControl.newRole({ user: [], session: [] }),
  viewer: authAccessControl.newRole({ user: [], session: [] })
} satisfies Record<Role, unknown>
