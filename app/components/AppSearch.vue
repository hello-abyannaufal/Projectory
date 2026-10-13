<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

interface Result { id: string, label: string, description: string | null, to: string, external?: boolean }
type Results = Record<'projects' | 'apps' | 'deployments' | 'accounts' | 'links' | 'envKeys', Result[]>

const { t } = useI18n()
const { can } = usePermissions()

const open = ref(false)
const searchTerm = ref('')
const results = ref<Results>()
const loading = ref(false)

// Pinned and recent projects, shown before anything is typed.
const { data: projects, execute: loadProjects } = useFetch('/api/projects', { default: () => [], immediate: false, server: false })

watch(open, (value) => {
  if (value) {
    loadProjects()
  }
})

let timer: ReturnType<typeof setTimeout> | undefined
let latest = 0
watch(searchTerm, (value) => {
  clearTimeout(timer)
  const term = value.trim()
  if (term.length < 2) {
    results.value = undefined
    loading.value = false
    return
  }
  loading.value = true
  timer = setTimeout(async () => {
    const id = ++latest
    const found = await request<Results>('/api/search', { query: { q: term } }).catch(() => undefined)
    // Ignore responses that arrive after a newer search.
    if (id === latest) {
      results.value = found
      loading.value = false
    }
  }, 250)
})

const RESULT_GROUPS = [
  { key: 'projects', icon: 'i-lucide-folder' },
  { key: 'deployments', icon: 'i-lucide-server' },
  { key: 'accounts', icon: 'i-lucide-key-round' },
  { key: 'envKeys', icon: 'i-lucide-file-key' },
  { key: 'apps', icon: 'i-lucide-app-window' },
  { key: 'links', icon: 'i-lucide-link' }
] as const

const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const navigation = {
    id: 'navigation',
    label: t('search.goTo'),
    items: [
      { label: t('nav.projects'), icon: 'i-lucide-folder', to: '/projects' },
      { label: t('nav.techStacks'), icon: 'i-lucide-layers', to: '/tech-stacks' },
      ...(can('edit') ? [{ label: t('nav.trash'), icon: 'i-lucide-trash-2', to: '/trash' }] : []),
      ...(can('manageUsers') ? [{ label: t('nav.users'), icon: 'i-lucide-users', to: '/users' }] : []),
      ...(can('viewAuditLog') ? [{ label: t('nav.auditLog'), icon: 'i-lucide-scroll-text', to: '/audit-log' }] : []),
      { label: t('nav.settings'), icon: 'i-lucide-settings-2', to: '/settings' }
    ]
  }

  if (results.value) {
    const found = RESULT_GROUPS
      .filter(group => results.value![group.key].length)
      .map(group => ({
        id: group.key,
        label: t(`search.groups.${group.key}`),
        ignoreFilter: true,
        items: results.value![group.key].map(result => ({
          label: result.label,
          suffix: result.description ?? undefined,
          icon: group.icon,
          to: result.to,
          ...(result.external ? { target: '_blank' } : {})
        }))
      }))
    return [...found, navigation]
  }

  const shortcuts = [...projects.value]
    .filter(project => project.pinnedAt || project.visitedAt)
    .sort((a, b) => Number(!!b.pinnedAt) - Number(!!a.pinnedAt) || new Date(b.visitedAt ?? 0).getTime() - new Date(a.visitedAt ?? 0).getTime())
  return [
    {
      id: 'projects',
      label: t('search.groups.projects'),
      items: (shortcuts.length ? shortcuts : projects.value).slice(0, 6).map(project => ({
        label: project.name,
        suffix: project.description ?? undefined,
        icon: project.pinnedAt ? 'i-lucide-pin' : 'i-lucide-folder',
        to: `/projects/${project.id}`
      }))
    },
    navigation
  ]
})
</script>

<template>
  <UDashboardSearch
    v-model:open="open"
    v-model:search-term="searchTerm"
    :groups="groups"
    :loading="loading"
    :placeholder="t('search.placeholder')"
  />
</template>
