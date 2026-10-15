import type { Permission } from '#shared/utils/permissions'

declare module '#app' {
  interface PageMeta {
    // Pages the signed-in role lacks this permission for redirect to /projects.
    permission?: Permission
  }
}

export {}
