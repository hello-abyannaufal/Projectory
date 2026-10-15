<script setup lang="ts">
definePageMeta({ permission: 'edit' })

const { t, locale } = useI18n()
const api = useApi()
const confirm = useConfirm()

useHead({ title: () => t('nav.trash') })

const { data: projects, refresh } = await useFetch('/api/trash', { default: () => [] })

async function restore(id: string) {
  if (await api(() => request(`/api/projects/${id}/restore`, { method: 'POST' }), t('trash.restored'))) {
    // Group project counts are cached under this key.
    await Promise.all([refresh(), refreshNuxtData('groups')])
  }
}

async function purge(project: { id: string, name: string }) {
  if (await confirm({ title: t('trash.purgeTitle', { name: project.name }), description: t('trash.purgeDescription'), confirmLabel: t('trash.purge') })
    && await api(() => request(`/api/trash/${project.id}`, { method: 'DELETE' }))) {
    await Promise.all([refresh(), refreshNuxtData('groups')])
  }
}
</script>

<template>
  <UDashboardPanel id="trash">
    <template #header>
      <UDashboardNavbar :title="t('nav.trash')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex max-w-4xl flex-col gap-3">
        <p class="text-sm text-muted">
          {{ t('trash.description', { days: TRASH_RETENTION_DAYS }) }}
        </p>

        <div
          v-for="project in projects"
          :key="project.id"
          class="flex flex-wrap items-center gap-4 rounded-lg border border-default bg-default p-4"
        >
          <ProjectCover
            :name="project.name"
            :cover="project.cover"
          />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="font-semibold text-highlighted">{{ project.name }}</span>
            <span class="text-sm text-muted">{{ project.group.name }}</span>
            <span class="text-xs text-dimmed">
              {{ t('trash.deletedBy', { name: project.deletedBy ?? '—', time: timeAgo(project.deletedAt!, locale) }) }}
              · {{ t('trash.purgeAt', { time: timeAgo(project.purgeAt, locale) }) }}
            </span>
          </div>
          <UButton
            icon="i-lucide-undo-2"
            color="neutral"
            variant="outline"
            :label="t('trash.restore')"
            @click="restore(project.id)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            :label="t('trash.purge')"
            @click="purge(project)"
          />
        </div>

        <UEmpty
          v-if="!projects.length"
          icon="i-lucide-trash-2"
          :title="t('trash.empty')"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
