<script setup lang="ts">
const props = defineProps<{
  project: ProjectDetail
}>()

const { t } = useI18n()
const api = useApi()
const { can } = usePermissions()

const columns = computed(() => `minmax(14rem, 16rem) repeat(${props.project.environments.length}, minmax(12rem, 1fr))`)

function cellFor(app: ProjectApp, environmentId: string) {
  return app.deployments.find(deployment => deployment.environmentId === environmentId)
}

function hostOf(url: string | null) {
  if (!url) {
    return null
  }
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

async function addDeployment(appId: string, environmentId: string) {
  const deployment = await api(() => request<{ id: string }>('/api/deployments', { method: 'POST', body: { appId, environmentId } }))
  if (deployment) {
    await navigateTo(`/projects/${props.project.id}/deployments/${deployment.id}`)
  }
}
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default bg-default">
    <div
      class="grid min-w-fit"
      :style="{ gridTemplateColumns: columns }"
    >
      <div class="border-b border-default bg-elevated/50 px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase">
        {{ t('apps.title') }}
      </div>
      <div
        v-for="environment in project.environments"
        :key="environment.id"
        class="flex items-center gap-2 border-b border-l border-default bg-elevated/50 px-4 py-3"
      >
        <span class="text-sm font-semibold text-highlighted">{{ environment.name }}</span>
        <UBadge
          v-if="environment.isProduction"
          color="warning"
          variant="subtle"
          icon="i-lucide-lock"
          size="sm"
          :label="t('environments.production')"
        />
      </div>

      <template
        v-for="app in project.apps"
        :key="app.id"
      >
        <div class="flex items-center gap-3 border-b border-default px-4 py-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-highlighted">
              {{ app.name }}
            </p>
            <p class="truncate text-xs text-muted">
              {{ app.platforms.map(p => t(`platform.${p}`)).join(' · ') || '—' }}
            </p>
          </div>
        </div>
        <div
          v-for="environment in project.environments"
          :key="environment.id"
          class="flex border-b border-l border-default p-2"
        >
          <NuxtLink
            v-if="cellFor(app, environment.id)"
            :to="`/projects/${project.id}/deployments/${cellFor(app, environment.id)!.id}`"
            class="flex min-w-0 flex-1 flex-col gap-1.5 rounded-md border border-default px-3 py-2.5 transition hover:border-primary hover:bg-primary/5"
          >
            <span class="truncate font-mono text-xs text-primary">
              {{ hostOf(cellFor(app, environment.id)!.url) ?? t('deployments.noUrl') }}
            </span>
            <span class="flex flex-wrap gap-x-3 text-xs text-muted">
              <span v-if="environment.isProduction">{{ t('deployments.noCredentials') }}</span>
              <span v-else>{{ t('deployments.accountCount', cellFor(app, environment.id)!.accountCount) }}</span>
              <span v-if="cellFor(app, environment.id)!.latestVersion">{{ cellFor(app, environment.id)!.latestVersion }}</span>
            </span>
          </NuxtLink>
          <UButton
            v-else-if="can('edit')"
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            :label="t('deployments.add')"
            class="flex-1 justify-center border border-dashed border-accented text-muted"
            @click="addDeployment(app.id, environment.id)"
          />
          <span
            v-else
            class="flex flex-1 items-center justify-center text-sm text-dimmed"
          >—</span>
        </div>
      </template>
    </div>
  </div>
</template>
