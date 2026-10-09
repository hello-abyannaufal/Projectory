<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('nav.settings') })
</script>

<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar :title="t('nav.settings')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div />
    </template>
  </UDashboardPanel>
</template>
