<script setup lang="ts">
definePageMeta({ permission: 'viewAuditLog' })

const { t, locale } = useI18n()

useHead({ title: () => t('nav.auditLog') })

const action = ref<AuditAction | 'all'>('all')
const userId = ref('all')
const search = ref('')
const query = ref('')
const page = ref(1)

// Search runs once typing settles.
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    query.value = value.trim()
  }, 300)
})

watch([action, userId, query], () => {
  page.value = 1
})

const { data, status } = await useFetch('/api/audit-logs', {
  query: computed(() => ({
    action: action.value === 'all' ? undefined : action.value,
    userId: userId.value === 'all' ? undefined : userId.value,
    q: query.value || undefined,
    page: page.value
  }))
})

const actionItems = computed(() => [
  { value: 'all', label: t('auditLog.allActions') },
  ...AUDIT_ACTIONS.map(value => ({ value, label: t(`auditAction.${value}`) }))
])

const userItems = computed(() => [
  { value: 'all', label: t('auditLog.allUsers') },
  ...(data.value?.actors ?? []).map(actor => ({ value: actor.id!, label: actor.name }))
])

function details(metadata: unknown) {
  return Object.entries((metadata ?? {}) as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ')
}
</script>

<template>
  <UDashboardPanel id="audit-log">
    <template #header>
      <UDashboardNavbar :title="t('nav.auditLog')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <div class="flex flex-wrap items-center gap-3 py-1">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="t('auditLog.searchPlaceholder')"
            class="w-full sm:w-72"
          />
          <USelect
            v-model="action"
            :items="actionItems"
            class="w-56"
          />
          <USelect
            v-model="userId"
            :items="userItems"
            class="w-44"
          />
        </div>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted">
          {{ t('auditLog.description') }}
        </p>

        <div
          v-if="data?.items.length"
          class="divide-y divide-default overflow-hidden rounded-lg border border-default bg-default"
          :class="status === 'pending' && 'opacity-60'"
        >
          <div
            v-for="entry in data.items"
            :key="entry.id"
            class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
          >
            <UTooltip :text="new Date(entry.createdAt).toLocaleString(locale)">
              <span class="w-28 shrink-0 text-xs text-muted">{{ timeAgo(entry.createdAt, locale) }}</span>
            </UTooltip>
            <span class="w-36 shrink-0 truncate text-sm font-medium text-highlighted">{{ entry.userName }}</span>
            <UBadge
              :color="auditActionColor(entry.action)"
              variant="subtle"
              :label="t(`auditAction.${entry.action}`)"
            />
            <div class="flex min-w-0 flex-1 flex-col">
              <NuxtLink
                v-if="entry.projectId && entry.target"
                :to="`/projects/${entry.projectId}`"
                class="truncate text-sm text-default hover:text-primary"
              >
                {{ entry.target }}
              </NuxtLink>
              <span
                v-else
                class="truncate text-sm text-default"
              >{{ entry.target ?? '—' }}</span>
              <span
                v-if="entry.metadata"
                class="truncate text-xs text-muted"
              >{{ details(entry.metadata) }}</span>
            </div>
            <span
              v-if="entry.ipAddress"
              class="font-mono text-xs text-dimmed"
            >{{ entry.ipAddress }}</span>
          </div>
        </div>

        <UEmpty
          v-else
          icon="i-lucide-scroll-text"
          :title="t('auditLog.empty')"
        />

        <UPagination
          v-if="data && data.total > data.pageSize"
          v-model:page="page"
          :total="data.total"
          :items-per-page="data.pageSize"
          class="self-center"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
