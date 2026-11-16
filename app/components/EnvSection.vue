<script setup lang="ts">
const props = defineProps<{
  deploymentId: string
  fileId: string
  // The file's path, shown as the title and used as the download name
  path: string
  envVars: DeploymentEnvVar[]
  editable?: boolean
  // Without it only the keys are shown, values stay masked.
  canReveal?: boolean
  // This deployment's environment and the app's other deployments, to compare with
  environmentName?: string
  siblings?: { id: string, name: string, isProduction: boolean }[]
}>()

const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const api = useApi()
const copy = useCopy()
const confirm = useConfirm()

const view = ref<'table' | 'raw'>('table')
const revealed = ref<{ id: string, key: string, value: string }[]>()
const visible = ref(false)

async function loadValues() {
  revealed.value ??= await api(() => request<{ id: string, key: string, value: string }[]>(`/api/env-files/${props.fileId}/reveal`))
  return revealed.value
}

// Stored values change after any edit.
watch(() => props.envVars, () => {
  revealed.value = undefined
  if (visible.value) {
    loadValues()
  }
})

async function toggleVisible() {
  if (!visible.value && !await loadValues()) {
    return
  }
  visible.value = !visible.value
}

function valueOf(id: string) {
  return visible.value ? revealed.value?.find(entry => entry.id === id)?.value ?? '' : SECRET_MASK
}

const rawText = computed(() => visible.value && revealed.value
  ? serializeDotenv(revealed.value)
  : props.envVars.map(entry => `${entry.key}=${SECRET_MASK}`).join('\n'))

async function copyValue(id: string) {
  const values = await loadValues()
  const entry = values?.find(item => item.id === id)
  if (entry) {
    await copy(entry.value)
  }
}

async function dotenvText() {
  const values = await loadValues()
  return values ? `${serializeDotenv(values)}\n` : undefined
}

async function copyAll() {
  const text = await dotenvText()
  if (text !== undefined) {
    await copy(text)
  }
}

async function download() {
  const text = await dotenvText()
  if (text === undefined) {
    return
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const link = document.createElement('a')
  link.href = url
  link.download = props.path.split('/').pop() || '.env'
  link.click()
  URL.revokeObjectURL(url)
}

// Add / edit one variable
const formOpen = ref(false)
const editing = ref<{ id: string, key: string, value: string }>()

async function openForm(envVar?: DeploymentEnvVar) {
  if (envVar) {
    const values = await loadValues()
    const entry = values?.find(item => item.id === envVar.id)
    if (!entry) {
      return
    }
    editing.value = entry
  } else {
    editing.value = undefined
  }
  formOpen.value = true
}

async function remove(envVar: DeploymentEnvVar) {
  if (await confirm({ title: t('env.deleteTitle', { key: envVar.key }) })
    && await api(() => request(`/api/env-vars/${envVar.id}`, { method: 'DELETE' }))) {
    emit('changed')
  }
}

async function removeAll() {
  if (await confirm({ title: t('env.deleteAllTitle', { count: props.envVars.length }), description: t('env.deleteAllDescription'), confirmLabel: t('env.deleteAll') })
    && await api(() => request(`/api/env-files/${props.fileId}/vars`, { method: 'DELETE' }))) {
    emit('changed')
  }
}

const historyOpen = ref(false)

// Compare with another environment of the same app; production stores no .env.
const compareOpen = ref(false)
const compareWith = ref<{ id: string, name: string }>()
const compareTargets = computed(() => (props.siblings ?? []).filter(sibling => sibling.id !== props.deploymentId && !sibling.isProduction))

// Rename or delete this file
const renameOpen = ref(false)

async function removeFile() {
  if (await confirm({ title: t('env.deleteFileTitle', { path: props.path }), description: t('env.deleteFileDescription'), confirmLabel: t('env.deleteFile') })
    && await api(() => request(`/api/env-files/${props.fileId}`, { method: 'DELETE' }))) {
    emit('changed')
  }
}

function openCompare(target: { id: string, name: string }) {
  compareWith.value = target
  compareOpen.value = true
}

// Import, and raw editing (saved through the same preview)
const importOpen = ref(false)
const rawEditing = ref(false)
const rawDraft = ref('')
const reviewContent = ref<string>()

async function startRawEdit() {
  const text = await dotenvText()
  if (text === undefined) {
    return
  }
  rawDraft.value = text
  rawEditing.value = true
}

function reviewRaw() {
  reviewContent.value = rawDraft.value
  importOpen.value = true
}

function openImport() {
  reviewContent.value = undefined
  importOpen.value = true
}

function onApplied() {
  rawEditing.value = false
  emit('changed')
}
</script>

<template>
  <section class="overflow-hidden rounded-lg border border-default bg-default">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
      <div class="flex items-center gap-2">
        <h2 class="font-semibold text-highlighted">
          {{ path }}
        </h2>
        <span class="inline-flex items-center gap-1 text-xs text-primary">
          <UIcon
            name="i-lucide-lock"
            class="size-3"
          />
          {{ t('env.encrypted') }}
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UTabs
          v-model="view"
          :items="[{ label: t('env.table'), value: 'table' }, { label: t('env.raw'), value: 'raw' }]"
          :content="false"
          size="xs"
        />
        <UButton
          v-if="!rawEditing && canReveal"
          :icon="visible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          color="neutral"
          variant="outline"
          size="sm"
          :label="visible ? t('env.hideValues') : t('env.revealValues')"
          @click="toggleVisible"
        />
        <UButton
          v-if="editable"
          icon="i-lucide-upload"
          color="neutral"
          variant="outline"
          size="sm"
          :label="t('env.import')"
          @click="openImport"
        />
        <UDropdownMenu
          :items="[[
            ...(canReveal ? [
              { label: t('env.copyAll'), icon: 'i-lucide-copy', onSelect: copyAll },
              { label: t('env.download'), icon: 'i-lucide-download', onSelect: download }
            ] : []),
            { label: t('envHistory.title'), icon: 'i-lucide-history', onSelect: () => { historyOpen = true } },
            ...(compareTargets.length ? [{
              label: t('envCompare.compareWith'),
              icon: 'i-lucide-git-compare-arrows',
              children: compareTargets.map(target => ({ label: target.name, onSelect: () => openCompare(target) }))
            }] : [])
          ], ...(editable ? [[
            { label: t('env.renameFile'), icon: 'i-lucide-pencil-line', onSelect: () => { renameOpen = true } },
            ...(envVars.length ? [{ label: t('env.deleteAll'), icon: 'i-lucide-eraser', color: 'error' as const, onSelect: removeAll }] : []),
            { label: t('env.deleteFile'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: removeFile }
          ]] : [])]"
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
    </div>

    <div
      v-if="view === 'table'"
      class="overflow-x-auto"
    >
      <div class="min-w-xl font-mono text-sm">
        <div
          v-for="envVar in envVars"
          :key="envVar.id"
          class="flex items-center gap-3 border-b border-default py-1 pr-2 pl-4"
        >
          <span class="w-72 shrink-0 truncate font-medium text-highlighted">{{ envVar.key }}</span>
          <span class="min-w-0 flex-1 truncate text-toned">{{ valueOf(envVar.id) }}</span>
          <UButton
            v-if="canReveal"
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="t('common.copy')"
            @click="copyValue(envVar.id)"
          />
          <template v-if="editable">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="t('common.edit')"
              @click="openForm(envVar)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              :aria-label="t('common.delete')"
              @click="remove(envVar)"
            />
          </template>
        </div>
        <p
          v-if="!envVars.length"
          class="px-4 py-6 font-sans text-sm text-muted"
        >
          {{ t('env.empty') }}
        </p>
        <UButton
          v-if="editable"
          icon="i-lucide-plus"
          variant="ghost"
          class="m-2 font-sans"
          :label="t('env.addVariable')"
          @click="openForm()"
        />
      </div>
    </div>

    <div
      v-else
      class="flex flex-col gap-3 p-4"
    >
      <template v-if="rawEditing">
        <UTextarea
          v-model="rawDraft"
          :rows="Math.max(8, rawDraft.split('\n').length + 1)"
          spellcheck="false"
          class="w-full"
          :ui="{ base: 'font-mono text-sm' }"
        />
        <div class="flex gap-2">
          <UButton
            :label="t('env.reviewChanges')"
            @click="reviewRaw"
          />
          <UButton
            color="neutral"
            variant="outline"
            :label="t('common.cancel')"
            @click="rawEditing = false"
          />
        </div>
      </template>
      <template v-else>
        <pre class="overflow-x-auto rounded-md bg-inverted p-4 font-mono text-sm leading-relaxed text-inverted">{{ rawText || t('env.empty') }}</pre>
        <div
          v-if="editable"
          class="flex flex-wrap items-center gap-3"
        >
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            :label="t('env.editAsText')"
            @click="startRawEdit"
          />
          <span class="text-xs text-muted">{{ t('env.rawHint') }}</span>
        </div>
      </template>
    </div>
  </section>

  <EnvFileFormModal
    v-model:open="renameOpen"
    :deployment-id="deploymentId"
    :file="{ id: fileId, path }"
    @saved="emit('changed')"
  />
  <EnvVarFormModal
    v-model:open="formOpen"
    :file-id="fileId"
    :env-var="editing"
    @saved="emit('changed')"
  />
  <EnvHistoryModal
    v-model:open="historyOpen"
    :file-id="fileId"
    :editable="editable"
    :can-reveal="canReveal"
    @restored="emit('changed')"
  />
  <EnvCompareModal
    v-model:open="compareOpen"
    :left="{ id: fileId, name: environmentName ?? path, path, keys: envVars.map(envVar => envVar.key) }"
    :right="compareWith"
    :can-reveal="canReveal"
  />
  <EnvImportModal
    v-model:open="importOpen"
    :file-id="fileId"
    :content="reviewContent"
    :replace="reviewContent !== undefined"
    @applied="onApplied"
  />
</template>
