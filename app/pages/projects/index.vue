<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('nav.projects') })
</script>

<template>
  <UDashboardPanel id="projects">
    <template #header>
      <UDashboardNavbar :title="t('nav.projects')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UEmpty
        icon="i-lucide-folder"
        :title="t('projects.empty')"
      />
    </template>
  </UDashboardPanel>
</template>
