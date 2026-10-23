<script setup lang="ts">
const props = defineProps<{
  left: { id: string, name: string, keys: string[] }
  right?: { id: string, name: string }
  // Without it only key presence is compared.
  canReveal?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

type Entry = { key: string, value: string }
type Status = 'same' | 'different' | 'onlyLeft' | 'onlyRight' | 'both'

const leftValues = ref<Map<string, string>>()
const rightValues = ref<Map<string, string>>()
const rightKeys = ref<string[]>([])
const loading = ref(false)
const onlyDifferences = ref(true)
const visible = ref(false)

const toMap = (entries: Entry[]) => new Map(entries.map(entry => [entry.key, entry.value]))

watch(open, async (value) => {
  if (!value || !props.right) {
    return
  }
  loading.value = true
  visible.value = false
  leftValues.value = undefined
  rightValues.value = undefined
  if (props.canReveal) {
    const [left, right] = await Promise.all([
      api(() => request<Entry[]>(`/api/deployments/${props.left.id}/env/reveal`)),
      api(() => request<Entry[]>(`/api/deployments/${props.right!.id}/env/reveal`))
    ])
    leftValues.value = left && toMap(left)
    rightValues.value = right && toMap(right)
    rightKeys.value = right?.map(entry => entry.key) ?? []
  } else {
    const other = await api(() => request<{ envVars: { key: string }[] }>(`/api/deployments/${props.right!.id}`))
    rightKeys.value = other?.envVars.map(entry => entry.key) ?? []
  }
  loading.value = false
})

const rows = computed(() => {
  const leftKeys = props.left.keys
  const keys = [...new Set([...leftKeys, ...rightKeys.value])]
  return keys.map((key) => {
    const inLeft = leftKeys.includes(key)
    const inRight = rightKeys.value.includes(key)
    let status: Status
    if (!inRight) {
      status = 'onlyLeft'
    } else if (!inLeft) {
      status = 'onlyRight'
    } else if (leftValues.value && rightValues.value) {
      status = leftValues.value.get(key) === rightValues.value.get(key) ? 'same' : 'different'
    } else {
      status = 'both'
    }
    return { key, status, left: leftValues.value?.get(key), right: rightValues.value?.get(key) }
  })
})

const shown = computed(() => onlyDifferences.value ? rows.value.filter(row => row.status !== 'same' && row.status !== 'both') : rows.value)

const statusColor = { same: 'neutral', both: 'neutral', different: 'warning', onlyLeft: 'error', onlyRight: 'error' } as const

function statusLabel(status: Status) {
  if (status === 'onlyLeft') {
    return t('envCompare.onlyIn', { name: props.left.name })
  }
  if (status === 'onlyRight') {
    return t('envCompare.onlyIn', { name: props.right?.name })
  }
  return t(`envCompare.status.${status}`)
}

function display(value: string | undefined, present: boolean) {
  if (!present) {
    return '—'
  }
  return visible.value && value !== undefined ? value : SECRET_MASK
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('envCompare.title', { left: left.name, right: right?.name })"
    :description="canReveal ? t('envCompare.description') : t('envCompare.keysOnly')"
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <USwitch
            v-model="onlyDifferences"
            :label="t('envCompare.onlyDifferences')"
            size="sm"
          />
          <UButton
            v-if="canReveal"
            :icon="visible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            color="neutral"
            variant="outline"
            size="sm"
            :label="visible ? t('env.hideValues') : t('env.revealValues')"
            @click="visible = !visible"
          />
        </div>

        <div
          class="overflow-x-auto rounded-md border border-default"
          :class="loading && 'opacity-60'"
        >
          <div class="grid min-w-2xl grid-cols-[minmax(10rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_9rem] text-sm">
            <div class="contents text-xs font-semibold text-muted uppercase">
              <span class="border-b border-default bg-elevated/50 px-3 py-2">{{ t('env.key') }}</span>
              <span class="border-b border-default bg-elevated/50 px-3 py-2">{{ left.name }}</span>
              <span class="border-b border-default bg-elevated/50 px-3 py-2">{{ right?.name }}</span>
              <span class="border-b border-default bg-elevated/50 px-3 py-2" />
            </div>
            <template
              v-for="row in shown"
              :key="row.key"
            >
              <span class="truncate border-b border-default px-3 py-2 font-mono font-medium text-highlighted">{{ row.key }}</span>
              <span class="truncate border-b border-default px-3 py-2 font-mono text-toned">{{ display(row.left, row.status !== 'onlyRight') }}</span>
              <span class="truncate border-b border-default px-3 py-2 font-mono text-toned">{{ display(row.right, row.status !== 'onlyLeft') }}</span>
              <span class="border-b border-default px-3 py-2">
                <UBadge
                  :color="statusColor[row.status]"
                  variant="subtle"
                  size="sm"
                  :label="statusLabel(row.status)"
                  class="max-w-full"
                />
              </span>
            </template>
          </div>
          <p
            v-if="!loading && !shown.length"
            class="p-4 text-sm text-muted"
          >
            {{ rows.length ? t('envCompare.identical') : t('env.empty') }}
          </p>
        </div>
      </div>
    </template>
  </UModal>
</template>
