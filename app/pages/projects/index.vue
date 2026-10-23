<script setup lang="ts">
const { t } = useI18n()
const { can } = usePermissions()
const api = useApi()
const confirm = useConfirm()

useHead({ title: () => t('nav.projects') })

const [{ data: projects, refresh: refreshProjects }, { data: groups, refresh: refreshGroups }] = await Promise.all([
  useFetch('/api/projects', { default: () => [] }),
  useGroups()
])

async function refresh() {
  await Promise.all([refreshProjects(), refreshGroups()])
}

const search = ref('')
const status = ref<ProjectStatus | 'all'>('all')
const filtering = computed(() => !!search.value.trim() || status.value !== 'all')

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return projects.value.filter(project =>
    (status.value === 'all' || project.status === status.value)
    && (!query || project.name.toLowerCase().includes(query) || project.description?.toLowerCase().includes(query))
  )
})

// While filtering, only groups with a match are shown.
const sections = computed(() => groups.value
  .map(group => ({ group, projects: filtered.value.filter(project => project.groupId === group.id) }))
  .filter(section => !filtering.value || section.projects.length))

const filters = computed(() => [
  { value: 'all' as const, label: t('common.all') },
  ...PROJECT_STATUSES.map(value => ({ value, label: t(`projectStatus.${value}`) }))
])

const hasOpenGroup = computed(() => groups.value.some(group => !group.locked))

// Personal shortcuts, hidden while filtering.
const RECENT_LIMIT = 4
const pinned = computed(() => projects.value
  .filter(project => project.pinnedAt)
  .sort((a, b) => a.name.localeCompare(b.name)))
const recent = computed(() => projects.value
  .filter(project => project.visitedAt && !project.pinnedAt)
  .sort((a, b) => new Date(b.visitedAt!).getTime() - new Date(a.visitedAt!).getTime())
  .slice(0, RECENT_LIMIT))
const shortcuts = computed(() => filtering.value
  ? []
  : [
      { key: 'pinned', icon: 'i-lucide-pin', title: t('projects.pinned'), projects: pinned.value },
      { key: 'recent', icon: 'i-lucide-history', title: t('projects.recent'), projects: recent.value }
    ].filter(section => section.projects.length))

async function togglePin(project: { id: string, pinnedAt: string | null }) {
  if (await api(() => request(`/api/projects/${project.id}/pin`, { method: project.pinnedAt ? 'DELETE' : 'POST' }))) {
    await refreshProjects()
  }
}

// Projects
const createOpen = ref(false)
const importOpen = ref(false)
const targetGroupId = ref<string>()

function openCreate(groupId?: string) {
  targetGroupId.value = groupId
  createOpen.value = true
}

async function onCreated(id: string) {
  await navigateTo(`/projects/${id}`)
}

// Groups
const groupFormOpen = ref(false)
const editingGroup = ref<Group>()

function openGroupForm(group?: Group) {
  editingGroup.value = group
  groupFormOpen.value = true
}

async function deleteGroup(group: Group) {
  if (await confirm({ title: t('groups.deleteTitle', { name: group.name }) })
    && await api(() => request(`/api/groups/${group.id}`, { method: 'DELETE' }))) {
    await refreshGroups()
  }
}

function groupMenu(group: Group) {
  return [[
    { label: t('groups.edit'), icon: 'i-lucide-pencil', onSelect: () => openGroupForm(group) },
    {
      label: group.projectCount ? t('groups.deleteNotEmpty') : group.trashedCount ? t('groups.deleteHasTrash') : t('groups.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      disabled: group.projectCount + group.trashedCount > 0,
      onSelect: () => deleteGroup(group)
    }
  ]]
}

const unlockOpen = ref(false)
const unlockingGroup = ref<Group>()

function openUnlock(group: Group) {
  unlockingGroup.value = group
  unlockOpen.value = true
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
              v-if="can('manageGroups')"
              icon="i-lucide-folder-plus"
              color="neutral"
              variant="outline"
              :label="t('groups.new')"
              @click="openGroupForm()"
            />
            <template v-if="can('edit') && hasOpenGroup">
              <UButton
                icon="i-lucide-upload"
                color="neutral"
                variant="outline"
                :label="t('import.button')"
                @click="importOpen = true"
              />
              <UButton
                icon="i-lucide-plus"
                :label="t('projects.new')"
                @click="openCreate()"
              />
            </template>
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
          v-if="!groups.length"
          icon="i-lucide-folders"
          :title="t('groups.empty')"
          :description="can('manageGroups') ? t('groups.emptyDescription') : t('groups.emptyDescriptionAsk')"
          :actions="can('manageGroups') ? [{ label: t('groups.new'), icon: 'i-lucide-folder-plus', onClick: () => openGroupForm() }] : []"
        />

        <div
          v-else
          class="flex flex-col gap-8"
        >
          <section
            v-for="section in shortcuts"
            :key="section.key"
            class="flex flex-col gap-3"
          >
            <div class="flex items-center gap-2">
              <UIcon
                :name="section.icon"
                class="size-5 shrink-0 text-muted"
              />
              <h2 class="font-semibold text-highlighted">
                {{ section.title }}
              </h2>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ProjectCard
                v-for="project in section.projects"
                :key="project.id"
                :project="project"
                @toggle-pin="togglePin(project)"
              />
            </div>
          </section>

          <section
            v-for="{ group, projects: groupProjects } in sections"
            :key="group.id"
            class="flex flex-col gap-3"
          >
            <div class="flex items-center gap-2">
              <UIcon
                :name="group.locked ? 'i-lucide-folder-lock' : 'i-lucide-folder'"
                class="size-5 shrink-0 text-muted"
              />
              <div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                <h2 class="font-semibold text-highlighted">
                  {{ group.name }}
                </h2>
                <span class="text-xs text-muted">{{ t('groups.projectCount', group.projectCount) }}</span>
                <UTooltip
                  v-if="group.hasAccessCode && !group.locked"
                  :text="t('groups.protected')"
                >
                  <UIcon
                    name="i-lucide-key-round"
                    class="size-3.5 text-muted"
                  />
                </UTooltip>
                <span
                  v-if="group.description"
                  class="w-full truncate text-sm text-muted"
                >{{ group.description }}</span>
              </div>
              <UButton
                v-if="can('edit') && !group.locked"
                icon="i-lucide-plus"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="t('projects.new')"
                @click="openCreate(group.id)"
              />
              <UDropdownMenu
                v-if="can('manageGroups')"
                :items="groupMenu(group)"
              >
                <UButton
                  icon="i-lucide-ellipsis-vertical"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :aria-label="t('common.more')"
                />
              </UDropdownMenu>
            </div>

            <div
              v-if="group.locked"
              class="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-accented px-5 py-4"
            >
              <UIcon
                name="i-lucide-lock"
                class="size-5 text-muted"
              />
              <p class="flex-1 text-sm text-muted">
                {{ t('groups.lockedDescription') }}
              </p>
              <UButton
                icon="i-lucide-lock-open"
                color="neutral"
                variant="outline"
                :label="t('groups.unlock')"
                @click="openUnlock(group)"
              />
            </div>

            <p
              v-else-if="!groupProjects.length"
              class="rounded-lg border border-dashed border-accented px-5 py-4 text-sm text-muted"
            >
              {{ t('groups.noProjects') }}
            </p>

            <div
              v-else
              class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
              <ProjectCard
                v-for="project in groupProjects"
                :key="project.id"
                :project="project"
                @toggle-pin="togglePin(project)"
              />
            </div>
          </section>

          <p
            v-if="filtering && !sections.length"
            class="text-sm text-muted"
          >
            {{ t('projects.noMatch') }}
          </p>
        </div>
      </template>
    </UDashboardPanel>

    <ProjectFormModal
      v-model:open="createOpen"
      :group-id="targetGroupId"
      @saved="onCreated"
    />
    <ImportProjectModal
      v-model:open="importOpen"
      @imported="onCreated"
    />
    <GroupFormModal
      v-model:open="groupFormOpen"
      :group="editingGroup"
      @saved="refreshGroups()"
    />
    <UnlockGroupModal
      v-model:open="unlockOpen"
      :group="unlockingGroup"
      @unlocked="refresh()"
    />
  </div>
</template>
