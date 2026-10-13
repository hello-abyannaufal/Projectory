<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const route = useRoute()
const { t } = useI18n()
const api = useApi()
const confirm = useConfirm()
const toast = useToast()
const { can } = usePermissions()

const projectId = computed(() => route.params.id as string)
const { data: project, refresh, error } = await useProject(projectId)

if (error.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Project not found', fatal: true })
}
if (error.value?.statusCode === 403) {
  throw createError({ statusCode: 403, statusMessage: 'This group is locked. Enter its access code on the Projects page.', fatal: true })
}

useHead({ title: () => project.value?.name ?? '' })

const techStacks = computed(() => {
  const map = new Map(project.value?.apps.flatMap(app => app.techStacks.map(stack => [stack.id, stack])) ?? [])
  return [...map.values()]
})
const platforms = computed(() => [...new Set(project.value?.apps.flatMap(app => app.platforms) ?? [])])

const tabs = computed<TabsItem[]>(() => [
  { label: t('deployments.title'), slot: 'deployments' as const, value: 'deployments' },
  { label: `${t('apps.title')} (${project.value?.apps.length ?? 0})`, slot: 'apps' as const, value: 'apps' },
  { label: `${t('environments.title')} (${project.value?.environments.length ?? 0})`, slot: 'environments' as const, value: 'environments' },
  { label: t('links.title'), slot: 'links' as const, value: 'links' },
  { label: t('fields.notes'), slot: 'notes' as const, value: 'notes' }
])
const activeTab = ref('deployments')

// Edit / delete / export project
const editOpen = ref(false)
const exportOpen = ref(false)

async function deleteProject() {
  if (!project.value) {
    return
  }
  const ok = await confirm({ title: t('projects.deleteTitle', { name: project.value.name }), description: t('projects.deleteDescription') })
  if (ok && await api(() => request(`/api/projects/${projectId.value}`, { method: 'DELETE' }))) {
    await navigateTo('/projects')
  }
}

// Cover
const coverInput = ref<HTMLInputElement>()

async function uploadCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }
  const body = new FormData()
  body.append('file', file)
  if (await api(() => request(`/api/projects/${projectId.value}/cover`, { method: 'POST', body }))) {
    await refresh()
  }
  coverInput.value!.value = ''
}

async function removeCover() {
  if (await api(() => request(`/api/projects/${projectId.value}/cover`, { method: 'DELETE' }))) {
    await refresh()
  }
}

const coverItems = computed(() => [[
  { label: t('projects.uploadCover'), icon: 'i-lucide-image-up', onSelect: () => coverInput.value?.click() },
  ...(project.value?.cover ? [{ label: t('projects.removeCover'), icon: 'i-lucide-trash-2', onSelect: removeCover }] : [])
]])

// Apps
const appOpen = ref(false)
const editingApp = ref<ProjectApp>()

function openApp(app?: ProjectApp) {
  editingApp.value = app
  appOpen.value = true
}

async function deleteApp(app: ProjectApp) {
  if (await confirm({ title: t('apps.deleteTitle', { name: app.name }), description: t('apps.deleteDescription') })
    && await api(() => request(`/api/apps/${app.id}`, { method: 'DELETE' }))) {
    await refresh()
  }
}

// Environments
const environmentOpen = ref(false)
const editingEnvironment = ref<ProjectEnvironment>()

function openEnvironment(environment?: ProjectEnvironment) {
  editingEnvironment.value = environment
  environmentOpen.value = true
}

async function deleteEnvironment(environment: ProjectEnvironment) {
  if (await confirm({ title: t('environments.deleteTitle', { name: environment.name }), description: t('environments.deleteDescription') })
    && await api(() => request(`/api/environments/${environment.id}`, { method: 'DELETE' }))) {
    await refresh()
  }
}

async function move(kind: 'environments' | 'apps', index: number, delta: number) {
  const list = [...(project.value?.[kind] ?? [])]
  const target = index + delta
  if (target < 0 || target >= list.length) {
    return
  }
  ;[list[index], list[target]] = [list[target]!, list[index]!]
  if (await api(() => request(`/api/projects/${projectId.value}/reorder`, { method: 'POST', body: { kind, ids: list.map(item => item.id) } }))) {
    await refresh()
  }
}

// Links
type AnyLink = { id: string, type: LinkType, label: string, url: string, appId: string | null }

const linkOpen = ref(false)
const editingLink = ref<AnyLink>()

const linkGroups = computed(() => [
  { id: null, name: t('links.wholeProject'), links: project.value?.links ?? [] },
  ...(project.value?.apps ?? []).map(app => ({ id: app.id, name: app.name, links: app.links }))
])

function openLink(link?: AnyLink) {
  editingLink.value = link
  linkOpen.value = true
}

async function deleteLink(link: AnyLink) {
  if (await confirm({ title: t('links.deleteTitle', { name: link.label }) })
    && await api(() => request(`/api/links/${link.id}`, { method: 'DELETE' }))) {
    await refresh()
  }
}

// Notes
const notes = ref<Record<string, unknown> | null>(null)
const notesSaving = ref(false)

watch(() => project.value?.notes, (value) => {
  notes.value = asDoc(value)
}, { immediate: true })

async function saveNotes() {
  notesSaving.value = true
  const saved = await api(() => request(`/api/projects/${projectId.value}`, { method: 'PATCH', body: { notes: notes.value } }))
  notesSaving.value = false
  if (saved) {
    toast.add({ title: t('common.saved'), color: 'success' })
  }
}
</script>

<template>
  <div class="contents">
    <UDashboardPanel
      v-if="project"
      id="project"
    >
      <template #header>
        <UDashboardNavbar>
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #title>
            <UBreadcrumb :items="[{ label: t('nav.projects'), to: '/projects' }, { label: project.group.name, to: '/projects' }, { label: project.name }]" />
          </template>
          <template #right>
            <UButton
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              :label="t('export.button')"
              @click="exportOpen = true"
            />
            <template v-if="can('edit')">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                :label="t('projects.edit')"
                @click="editOpen = true"
              />
              <UDropdownMenu :items="[[{ label: t('projects.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: deleteProject }]]">
                <UButton
                  icon="i-lucide-ellipsis-vertical"
                  color="neutral"
                  variant="ghost"
                  :aria-label="t('common.more')"
                />
              </UDropdownMenu>
            </template>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="flex flex-col gap-6">
          <div class="flex flex-wrap items-start gap-4">
            <UDropdownMenu
              :items="coverItems"
              :disabled="!can('edit')"
            >
              <button
                type="button"
                class="rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
                :aria-label="t('projects.uploadCover')"
              >
                <ProjectCover
                  :name="project.name"
                  :cover="project.cover"
                  size="lg"
                />
              </button>
            </UDropdownMenu>
            <input
              ref="coverInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              class="hidden"
              @change="uploadCover"
            >
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <div class="flex flex-wrap items-center gap-2.5">
                <h1 class="text-2xl font-bold text-highlighted">
                  {{ project.name }}
                </h1>
                <UBadge
                  :color="projectStatusColor[project.status]"
                  variant="subtle"
                  class="rounded-full"
                  :label="t(`projectStatus.${project.status}`)"
                />
              </div>
              <p
                v-if="project.description"
                class="max-w-3xl text-sm text-muted"
              >
                {{ project.description }}
              </p>
              <div class="flex flex-wrap items-center gap-1.5">
                <span
                  v-if="platforms.length"
                  class="mr-1 text-xs text-muted"
                >{{ platforms.map(p => t(`platform.${p}`)).join(' · ') }}</span>
                <span
                  v-for="stack in techStacks"
                  :key="stack.id"
                  class="inline-flex items-center gap-1.5 rounded-md border border-default bg-default px-2 py-0.5 text-xs text-toned"
                >
                  <TechStackIcon :stack="stack" />
                  {{ stack.name }}
                </span>
              </div>
            </div>
          </div>

          <UTabs
            v-model="activeTab"
            :items="tabs"
            variant="link"
            :ui="{ list: 'overflow-x-auto', content: 'pt-4' }"
          >
            <template #deployments>
              <UEmpty
                v-if="!project.apps.length || !project.environments.length"
                icon="i-lucide-grid-2x2"
                :title="t('deployments.emptyTitle')"
                :description="t('deployments.emptyDescription')"
                :actions="can('edit') ? [
                  { label: t('apps.new'), icon: 'i-lucide-plus', onClick: () => openApp() },
                  { label: t('environments.new'), icon: 'i-lucide-plus', color: 'neutral', variant: 'outline', onClick: () => openEnvironment() }
                ] : []"
              />
              <template v-else>
                <DeploymentMatrix :project="project" />
                <div
                  v-if="can('edit')"
                  class="mt-3 flex flex-wrap gap-2"
                >
                  <UButton
                    icon="i-lucide-plus"
                    variant="ghost"
                    :label="t('apps.new')"
                    @click="openApp()"
                  />
                  <UButton
                    icon="i-lucide-plus"
                    variant="ghost"
                    :label="t('environments.new')"
                    @click="openEnvironment()"
                  />
                </div>
              </template>
            </template>

            <template #apps>
              <div class="flex flex-col gap-3">
                <div
                  v-for="(app, index) in project.apps"
                  :key="app.id"
                  class="flex flex-wrap items-center gap-4 rounded-lg border border-default bg-default p-4"
                >
                  <div class="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span class="font-semibold text-highlighted">{{ app.name }}</span>
                    <span
                      v-if="app.description"
                      class="text-sm text-muted"
                    >{{ app.description }}</span>
                    <div class="flex flex-wrap items-center gap-1.5">
                      <UBadge
                        v-for="platform in app.platforms"
                        :key="platform"
                        color="neutral"
                        variant="soft"
                        :label="t(`platform.${platform}`)"
                      />
                      <span
                        v-for="stack in app.techStacks"
                        :key="stack.id"
                        class="inline-flex items-center gap-1.5 rounded-md bg-elevated px-2 py-0.5 text-xs text-toned"
                      >
                        <TechStackIcon :stack="stack" />
                        {{ stack.name }}
                      </span>
                    </div>
                  </div>
                  <div
                    v-if="can('edit')"
                    class="flex items-center gap-1"
                  >
                    <UButton
                      icon="i-lucide-arrow-up"
                      color="neutral"
                      variant="ghost"
                      :disabled="index === 0"
                      :aria-label="t('common.moveUp')"
                      @click="move('apps', index, -1)"
                    />
                    <UButton
                      icon="i-lucide-arrow-down"
                      color="neutral"
                      variant="ghost"
                      :disabled="index === project.apps.length - 1"
                      :aria-label="t('common.moveDown')"
                      @click="move('apps', index, 1)"
                    />
                    <UButton
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      :aria-label="t('common.edit')"
                      @click="openApp(app)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      :aria-label="t('common.delete')"
                      @click="deleteApp(app)"
                    />
                  </div>
                </div>
                <UButton
                  v-if="can('edit')"
                  icon="i-lucide-plus"
                  variant="ghost"
                  class="self-start"
                  :label="t('apps.new')"
                  @click="openApp()"
                />
              </div>
            </template>

            <template #environments>
              <div class="flex flex-col gap-2">
                <div
                  v-for="(environment, index) in project.environments"
                  :key="environment.id"
                  class="flex items-center gap-3 rounded-lg border border-default bg-default px-4 py-3"
                >
                  <span class="flex-1 font-medium text-highlighted">{{ environment.name }}</span>
                  <UBadge
                    v-if="environment.isProduction"
                    color="warning"
                    variant="subtle"
                    icon="i-lucide-lock"
                    :label="t('environments.production')"
                  />
                  <template v-if="can('edit')">
                    <UButton
                      icon="i-lucide-arrow-up"
                      color="neutral"
                      variant="ghost"
                      :disabled="index === 0"
                      :aria-label="t('common.moveUp')"
                      @click="move('environments', index, -1)"
                    />
                    <UButton
                      icon="i-lucide-arrow-down"
                      color="neutral"
                      variant="ghost"
                      :disabled="index === project.environments.length - 1"
                      :aria-label="t('common.moveDown')"
                      @click="move('environments', index, 1)"
                    />
                    <UButton
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      :aria-label="t('common.edit')"
                      @click="openEnvironment(environment)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      :aria-label="t('common.delete')"
                      @click="deleteEnvironment(environment)"
                    />
                  </template>
                </div>
                <UButton
                  v-if="can('edit')"
                  icon="i-lucide-plus"
                  variant="ghost"
                  class="self-start"
                  :label="t('environments.new')"
                  @click="openEnvironment()"
                />
              </div>
            </template>

            <template #links>
              <div class="flex flex-col gap-5">
                <template
                  v-for="group in linkGroups"
                  :key="group.id ?? 'project'"
                >
                  <section
                    v-if="group.links.length"
                    class="flex flex-col gap-2"
                  >
                    <h3 class="text-sm font-semibold text-muted">
                      {{ group.name }}
                    </h3>
                    <div
                      v-for="link in group.links"
                      :key="link.id"
                      class="flex items-center gap-3 rounded-lg border border-default bg-default px-4 py-2.5"
                    >
                      <UBadge
                        color="neutral"
                        variant="soft"
                        :label="t(`linkType.${link.type}`)"
                      />
                      <a
                        :href="link.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="min-w-0 flex-1 truncate text-sm text-highlighted hover:text-primary"
                      >{{ link.label }}</a>
                      <template v-if="can('edit')">
                        <UButton
                          icon="i-lucide-pencil"
                          color="neutral"
                          variant="ghost"
                          :aria-label="t('common.edit')"
                          @click="openLink(link)"
                        />
                        <UButton
                          icon="i-lucide-trash-2"
                          color="error"
                          variant="ghost"
                          :aria-label="t('common.delete')"
                          @click="deleteLink(link)"
                        />
                      </template>
                    </div>
                  </section>
                </template>
                <UButton
                  v-if="can('edit')"
                  icon="i-lucide-plus"
                  variant="ghost"
                  class="self-start"
                  :label="t('links.new')"
                  @click="openLink()"
                />
              </div>
            </template>

            <template #notes>
              <div class="flex flex-col gap-3">
                <UAlert
                  v-if="can('edit')"
                  color="warning"
                  variant="subtle"
                  icon="i-lucide-triangle-alert"
                  :title="t('notes.warning')"
                />
                <RichTextEditor
                  v-model="notes"
                  :editable="can('edit')"
                  :placeholder="t('notes.placeholder')"
                />
                <UButton
                  v-if="can('edit')"
                  class="self-start"
                  :loading="notesSaving"
                  :label="t('common.save')"
                  @click="saveNotes"
                />
              </div>
            </template>
          </UTabs>
        </div>
      </template>
    </UDashboardPanel>

    <ProjectFormModal
      v-if="project"
      v-model:open="editOpen"
      :project="project"
      @saved="refresh()"
    />
    <ExportProjectModal
      v-if="project"
      v-model:open="exportOpen"
      :project-id="project.id"
      :project-name="project.name"
    />
    <AppFormModal
      v-model:open="appOpen"
      :project-id="projectId"
      :app="editingApp"
      @saved="refresh()"
    />
    <EnvironmentFormModal
      v-model:open="environmentOpen"
      :project-id="projectId"
      :environment="editingEnvironment"
      @saved="refresh()"
    />
    <LinkFormModal
      v-if="project"
      v-model:open="linkOpen"
      :project-id="projectId"
      :apps="project.apps"
      :link="editingLink"
      @saved="refresh()"
    />
  </div>
</template>
