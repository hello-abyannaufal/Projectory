<script setup lang="ts">
const props = defineProps<{
  deploymentId: string
  editable?: boolean
  canReveal?: boolean
}>()

const emit = defineEmits<{ restored: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t, locale } = useI18n()
const api = useApi()
const confirm = useConfirm()

interface Version {
  id: string
  action: EnvVersionAction
  userName: string | null
  createdAt: string
  keyCount: number
  added: string[]
  changed: string[]
  removed: string[]
}

interface Values { entries: { key: string, value: string }[], previous: { key: string, value: string }[] }

const versions = ref<Version[]>([])
const selectedId = ref<string>()
const loading = ref(false)
// Revealed values per version id
const values = ref<Record<string, Values>>({})

watch(open, async (value) => {
  if (!value) {
    return
  }
  loading.value = true
  versions.value = await api(() => request<Version[]>(`/api/deployments/${props.deploymentId}/env/history`)) ?? []
  loading.value = false
  values.value = {}
  selectedId.value = versions.value[0]?.id
})

const selected = computed(() => versions.value.find(version => version.id === selectedId.value))
const isCurrent = computed(() => selectedId.value === versions.value[0]?.id)
const revealed = computed(() => selectedId.value ? values.value[selectedId.value] : undefined)

const rows = computed(() => {
  const version = selected.value
  if (!version) {
    return []
  }
  const before = new Map(revealed.value?.previous.map(entry => [entry.key, entry.value]))
  const after = new Map(revealed.value?.entries.map(entry => [entry.key, entry.value]))
  return [
    ...version.added.map(key => ({ key, kind: 'added' as const })),
    ...version.changed.map(key => ({ key, kind: 'changed' as const })),
    ...version.removed.map(key => ({ key, kind: 'removed' as const }))
  ].map(row => ({ ...row, before: before.get(row.key), after: after.get(row.key) }))
})

const kindColor = { added: 'success', changed: 'warning', removed: 'error' } as const

async function reveal() {
  const id = selectedId.value
  if (!id) {
    return
  }
  const result = await api(() => request<Values>(`/api/env-versions/${id}/reveal`))
  if (result) {
    values.value = { ...values.value, [id]: result }
  }
}

async function restore() {
  const version = selected.value
  if (!version) {
    return
  }
  const when = new Date(version.createdAt).toLocaleString(locale.value)
  if (await confirm({ title: t('envHistory.restoreTitle', { time: when }), description: t('envHistory.restoreDescription'), confirmLabel: t('envHistory.restore') })
    && await api(() => request(`/api/env-versions/${version.id}/restore`, { method: 'POST' }), t('envHistory.restored'))) {
    open.value = false
    emit('restored')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('envHistory.title')"
    :description="t('envHistory.description', { count: ENV_HISTORY_LIMIT })"
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <p
        v-if="!loading && !versions.length"
        class="text-sm text-muted"
      >
        {{ t('envHistory.empty') }}
      </p>

      <div
        v-else
        class="grid gap-4 md:grid-cols-[16rem_1fr]"
      >
        <nav class="flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
          <button
            v-for="(version, index) in versions"
            :key="version.id"
            type="button"
            :class="[
              'flex flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm',
              version.id === selectedId ? 'bg-elevated' : 'hover:bg-elevated/50'
            ]"
            @click="selectedId = version.id"
          >
            <span class="flex items-center gap-2 font-medium text-highlighted">
              {{ t(`envHistory.action.${version.action}`) }}
              <UBadge
                v-if="index === 0"
                color="primary"
                variant="subtle"
                size="sm"
                :label="t('envHistory.current')"
              />
            </span>
            <span class="text-xs text-muted">
              {{ version.userName ?? '—' }} · {{ timeAgo(version.createdAt, locale) }}
            </span>
            <span class="font-mono text-xs">
              <span class="text-success">+{{ version.added.length }}</span>
              <span class="ml-2 text-warning">~{{ version.changed.length }}</span>
              <span class="ml-2 text-error">−{{ version.removed.length }}</span>
            </span>
          </button>
        </nav>

        <div
          v-if="selected"
          class="flex min-w-0 flex-col gap-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-sm font-medium text-highlighted">
                {{ new Date(selected.createdAt).toLocaleString(locale) }}
              </p>
              <p class="text-xs text-muted">
                {{ t('envHistory.keyCount', { count: selected.keyCount }) }}
              </p>
            </div>
            <UButton
              v-if="canReveal && !revealed && rows.length"
              icon="i-lucide-eye"
              color="neutral"
              variant="outline"
              size="sm"
              :label="t('env.revealValues')"
              @click="reveal"
            />
          </div>

          <div class="max-h-96 divide-y divide-default overflow-y-auto rounded-md border border-default">
            <div
              v-for="row in rows"
              :key="row.key"
              class="flex flex-col gap-1 px-3 py-2"
            >
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate font-mono text-sm text-highlighted">{{ row.key }}</span>
                <UBadge
                  :color="kindColor[row.kind]"
                  variant="subtle"
                  size="sm"
                  :label="t(`env.kind.${row.kind}`)"
                />
              </div>
              <div
                v-if="revealed"
                class="flex flex-col gap-0.5 font-mono text-xs break-all"
              >
                <span
                  v-if="row.before !== undefined"
                  class="text-error"
                >− {{ row.before }}</span>
                <span
                  v-if="row.after !== undefined"
                  class="text-success"
                >+ {{ row.after }}</span>
              </div>
            </div>
            <p
              v-if="!rows.length"
              class="p-4 text-sm text-muted"
            >
              {{ t('envHistory.noChanges') }}
            </p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="t('common.close')"
          @click="open = false"
        />
        <UButton
          v-if="editable && selected && !isCurrent"
          icon="i-lucide-history"
          :label="t('envHistory.restore')"
          @click="restore"
        />
      </div>
    </template>
  </UModal>
</template>
