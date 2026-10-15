<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const { can } = usePermissions()

useIdleSignOut()

const links = computed<NavigationMenuItem[]>(() => [
  { label: t('nav.projects'), icon: 'i-lucide-folder', to: '/projects' },
  { label: t('nav.techStacks'), icon: 'i-lucide-layers', to: '/tech-stacks' },
  ...(can('manageUsers') ? [{ label: t('nav.users'), icon: 'i-lucide-users', to: '/users' }] : []),
  ...(can('edit') ? [{ label: t('nav.trash'), icon: 'i-lucide-trash-2', to: '/trash' }] : []),
  ...(can('viewAuditLog') ? [{ label: t('nav.auditLog'), icon: 'i-lucide-scroll-text', to: '/audit-log' }] : []),
  { label: t('nav.settings'), icon: 'i-lucide-settings-2', to: '/settings' }
])
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      collapsible
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          to="/projects"
          class="flex items-center gap-2.5 px-1"
        >
          <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-inverted text-sm font-bold text-inverted">B</span>
          <span
            v-if="!collapsed"
            class="font-bold text-highlighted"
          >Projectory</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton
          :collapsed="collapsed"
          :label="t('search.button')"
          class="bg-transparent ring-default"
        />
        <UNavigationMenu
          :collapsed="collapsed"
          :items="links"
          orientation="vertical"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />

    <AppSearch />
  </UDashboardGroup>
</template>
