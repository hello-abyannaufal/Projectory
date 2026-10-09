<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('nav.techStacks') })
</script>

<template>
  <UDashboardPanel id="tech-stacks">
    <template #header>
      <UDashboardNavbar :title="t('nav.techStacks')">
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
