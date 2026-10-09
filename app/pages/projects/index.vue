<script setup lang="ts">
const { t, locale } = useI18n()

useHead({ title: () => t('nav.projects') })

const { data: projects } = await useFetch('/api/projects', { default: () => [] })

const search = ref('')
const status = ref<ProjectStatus | 'all'>('all')

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return projects.value.filter(project =>
    (status.value === 'all' || project.status === status.value)
    && (!query || project.name.toLowerCase().includes(query) || project.description?.toLowerCase().includes(query))
  )
})

const filters = computed(() => [
  { value: 'all' as const, label: t('common.all') },
  ...PROJECT_STATUSES.map(value => ({ value, label: t(`projectStatus.${value}`) }))
])

const createOpen = ref(false)

async function onCreated(id: string) {
  await navigateTo(`/projects/${id}`)
}
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="projects">
      <template #header>
        <UDashboardNavbar :title="t('nav.projects')">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <UButton
              icon="i-lucide-plus"
              :label="t('projects.new')"
              @click="createOpen = true"
            />
          </template>
        </UDashboardNavbar>

        <UDashboardToolbar>
          <div class="flex flex-wrap items-center gap-3 py-1">
            <UInput
              v-model="search"
              icon="i-lucide-search"
              :placeholder="t('projects.searchPlaceholder')"
              class="w-full sm:w-72"
            />
            <div class="flex flex-wrap gap-1.5">
              <UButton
                v-for="filter in filters"
                :key="filter.value"
                :label="filter.label"
                size="sm"
                color="neutral"
                :variant="status === filter.value ? 'solid' : 'outline'"
                class="rounded-full"
                @click="status = filter.value"
              />
            </div>
          </div>
        </UDashboardToolbar>
      </template>

      <template #body>
        <UEmpty
          v-if="!projects.length"
          icon="i-lucide-folder"
          :title="t('projects.empty')"
          :description="t('projects.emptyDescription')"
          :actions="[{ label: t('projects.new'), icon: 'i-lucide-plus', onClick: () => { createOpen = true } }]"
        />

        <div
          v-else
          class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          <NuxtLink
            v-for="project in filtered"
            :key="project.id"
            :to="`/projects/${project.id}`"
            class="flex flex-col gap-3.5 rounded-lg border border-default bg-default p-5 transition hover:border-accented hover:shadow-sm"
          >
            <div class="flex items-start gap-3">
              <ProjectCover
                :name="project.name"
                :cover="project.cover"
              />
              <div class="flex min-w-0 flex-col items-start gap-1">
                <span class="font-semibold text-highlighted">{{ project.name }}</span>
                <UBadge
                  :color="projectStatusColor[project.status]"
                  variant="subtle"
                  :label="t(`projectStatus.${project.status}`)"
                  class="rounded-full"
                />
              </div>
            </div>
            <p
              v-if="project.description"
              class="line-clamp-2 text-sm text-muted"
            >
              {{ project.description }}
            </p>
            <div
              v-if="project.techStacks.length"
              class="flex flex-wrap gap-1.5"
            >
              <span
                v-for="stack in project.techStacks"
                :key="stack.id"
                class="inline-flex items-center gap-1.5 rounded-md bg-elevated px-2 py-0.5 text-xs text-toned"
              >
                <TechStackIcon :stack="stack" />
                {{ stack.name }}
              </span>
            </div>
            <div class="mt-auto flex flex-wrap justify-between gap-2 border-t border-default pt-3 text-xs text-muted">
              <span>{{ project.platforms.map(p => t(`platform.${p}`)).join(' · ') || '—' }}</span>
              <span>
                {{ t('projects.appCount', project.appCount) }} · {{ t('projects.environmentCount', project.environmentCount) }} · {{ timeAgo(project.updatedAt, locale) }}
              </span>
            </div>
          </NuxtLink>
        </div>
      </template>
    </UDashboardPanel>

    <ProjectFormModal
      v-model:open="createOpen"
      @saved="onCreated"
    />
  </div>
</template>
