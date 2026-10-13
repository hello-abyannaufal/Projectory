// The signed-in user's role, kept current by middleware/auth.global.ts.
export function useRole() {
  return useState<Role | undefined>('role', () => undefined)
}

// What the signed-in user's role allows; see shared/utils/permissions.ts.
export function usePermissions() {
  const role = useRole()
  return {
    role,
    can: (permission: Permission) => hasPermission(role.value, permission)
  }
}
