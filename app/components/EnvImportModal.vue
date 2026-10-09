<script setup lang="ts">
const props = defineProps<{
  deploymentId: string
  // Raw-editor mode: preview this content directly and delete missing keys
  content?: string
  replace?: boolean
}>()

const emit = defineEmits<{ applied: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

interface Diff { added: string[], changed: string[], unchanged: string[], removed: string[] }

const mode = ref<'paste' | 'upload'>('paste')
const text = ref('')
const fileName = ref('')
const diff = ref<Diff>()
const skip = ref(new Set<string>())
const loading = ref(false)

watch(open, async (value) => {
  if (!value) {
    return
  }
  text.value = props.content ?? ''
  fileName.value = ''
  diff.value = undefined
  skip.value = new Set()
  if (props.content !== undefined) {
    await preview()
  }
})

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    fileName.value = file.name
    text.value = await file.text()
  }
}

async function preview() {
  loading.value = true
  diff.value = await api(() => request<Diff>(`/api/deployments/${props.deploymentId}/env/import`, {
    method: 'POST',
    body: { content: text.value, replace: props.replace ?? false }
  }))
  loading.value = false
}

function toggleSkip(key: string, value: boolean) {
  const next = new Set(skip.value)
  if (value) {
    next.add(key)
  } else {
    next.delete(key)
  }
  skip.value = next
}

const importCount = computed(() => (diff.value?.added.length ?? 0) + (diff.value?.changed.filter(key => !skip.value.has(key)).length ?? 0))

const rows = computed(() => diff.value
  ? [
      ...diff.value.added.map(key => ({ key, kind: 'added' as const })),
      ...diff.value.changed.map(key => ({ key, kind: 'changed' as const })),
      ...diff.value.removed.map(key => ({ key, kind: 'removed' as const })),
      ...diff.value.unchanged.map(key => ({ key, kind: 'unchanged' as const }))
    ]
  : [])

const kindColor = { added: 'success', changed: 'warning', removed: 'error', unchanged: 'neutral' } as const

async function apply() {
  loading.value = true
  const result = await api(() => request(`/api/deployments/${props.deploymentId}/env/import`, {
    method: 'POST',
    body: { content: text.value, apply: true, skip: [...skip.value], replace: props.replace ?? false }
  }), t('common.saved'))
  loading.value = false
  if (result) {
    open.value = false
    emit('applied')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="replace ? t('env.reviewChanges') : t('env.import')"
    :description="diff ? t('env.step2') : t('env.step1')"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div
        v-if="!diff"
        class="flex flex-col gap-4"
      >
        <UTabs
          v-model="mode"
          :items="[{ label: t('env.paste'), value: 'paste' }, { label: t('env.upload'), value: 'upload' }]"
          :content="false"
          size="sm"
          class="w-fit"
        />
        <UTextarea
          v-if="mode === 'paste'"
          v-model="text"
          :rows="12"
          spellcheck="false"
          :placeholder="'KEY=value\n# comment\nexport OTHER=&quot;quoted&quot;'"
          :ui="{ base: 'font-mono text-sm' }"
          class="w-full"
        />
        <label
          v-else
          class="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-accented bg-elevated/40 p-6 text-center"
        >
          <UIcon
            name="i-lucide-file-up"
            class="size-8 text-primary"
          />
          <span class="font-semibold text-highlighted">{{ fileName || t('env.chooseFile') }}</span>
          <span class="text-xs text-muted">.env, .env.uat, .env.example…</span>
          <input
            type="file"
            class="sr-only"
            @change="onFile"
          >
        </label>
        <p class="text-xs text-muted">
          {{ t('env.parserHint') }}
        </p>
      </div>

      <div
        v-else
        class="flex flex-col gap-3"
      >
        <div class="flex flex-wrap gap-2">
          <UBadge
            color="success"
            variant="subtle"
            :label="t('env.addedCount', { count: diff.added.length })"
          />
          <UBadge
            color="warning"
            variant="subtle"
            :label="t('env.changedCount', { count: diff.changed.length })"
          />
          <UBadge
            v-if="replace"
            color="error"
            variant="subtle"
            :label="t('env.removedCount', { count: diff.removed.length })"
          />
          <UBadge
            color="neutral"
            variant="subtle"
            :label="t('env.unchangedCount', { count: diff.unchanged.length })"
          />
        </div>
        <div class="max-h-96 divide-y divide-default overflow-y-auto rounded-md border border-default">
          <div
            v-for="row in rows"
            :key="row.key"
            class="flex flex-wrap items-center gap-2 px-3 py-2"
          >
            <span class="min-w-0 flex-1 truncate font-mono text-sm">{{ row.key }}</span>
            <UBadge
              :color="kindColor[row.kind]"
              variant="subtle"
              size="sm"
              :label="t(`env.kind.${row.kind}`)"
            />
            <USwitch
              v-if="row.kind === 'changed'"
              :model-value="!skip.has(row.key)"
              :label="t('env.overwrite')"
              size="sm"
              @update:model-value="value => toggleSkip(row.key, !value)"
            />
          </div>
          <p
            v-if="!rows.length"
            class="p-4 text-sm text-muted"
          >
            {{ t('env.nothingFound') }}
          </p>
        </div>
        <p class="text-xs text-muted">
          {{ replace ? t('env.replaceHint') : t('env.keepHint') }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          v-if="diff && !content"
          color="neutral"
          variant="outline"
          :label="t('common.back')"
          @click="diff = undefined"
        />
        <UButton
          v-else
          color="neutral"
          variant="outline"
          :label="t('common.cancel')"
          @click="open = false"
        />
        <UButton
          v-if="!diff"
          :loading="loading"
          :disabled="!text.trim()"
          :label="t('env.preview')"
          @click="preview"
        />
        <UButton
          v-else
          :loading="loading"
          :disabled="!importCount && !(replace && diff.removed.length)"
          :label="replace ? t('common.save') : t('env.importCount', { count: importCount })"
          @click="apply"
        />
      </div>
    </template>
  </UModal>
</template>
