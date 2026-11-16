<script setup lang="ts">
const props = defineProps<{
  appId: string
  appName: string
  // Opens this file right away
  fileId?: string
  editable?: boolean
  // Without it only the file paths are listed.
  canReveal?: boolean
}>()

const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()
const confirm = useConfirm()
const copy = useCopy()

type AppFile = { id: string, path: string }

const files = ref<AppFile[]>([])
// A file id, or 'new' while adding one.
const selected = ref<string>()
const draft = reactive({ path: '', content: '' })
const saving = ref(false)

async function loadFiles() {
  files.value = await api(() => request<AppFile[]>(`/api/apps/${props.appId}/files`)) ?? []
}

// Opening a file reveals its content, which is recorded in the audit log.
async function select(id: string) {
  if (!props.canReveal) {
    return
  }
  const file = await api(() => request<AppFile & { content: string }>(`/api/app-files/${id}/reveal`))
  if (file) {
    selected.value = id
    Object.assign(draft, { path: file.path, content: file.content })
  }
}

function startNew() {
  selected.value = 'new'
  Object.assign(draft, { path: '.vscode/launch.json', content: '' })
}

watch(open, async (value) => {
  if (value) {
    selected.value = undefined
    await loadFiles()
    if (props.fileId && files.value.some(file => file.id === props.fileId)) {
      await select(props.fileId)
    }
  }
})

async function save() {
  saving.value = true
  const isNew = selected.value === 'new'
  const result = await api(() => isNew
    ? request<AppFile>(`/api/apps/${props.appId}/files`, { method: 'POST', body: { ...draft } })
    : request<unknown>(`/api/app-files/${selected.value}`, { method: 'PATCH', body: { ...draft } }))
  saving.value = false
  if (result) {
    if (isNew) {
      selected.value = (result as AppFile).id
    }
    await loadFiles()
    emit('changed')
  }
}

async function remove() {
  if (await confirm({ title: t('appFiles.deleteTitle', { path: draft.path }), description: t('appFiles.deleteDescription') })
    && await api(() => request(`/api/app-files/${selected.value}`, { method: 'DELETE' }))) {
    selected.value = undefined
    await loadFiles()
    emit('changed')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('appFiles.title')"
    :description="t('appFiles.description', { name: appName })"
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-4 sm:flex-row">
        <div class="flex shrink-0 flex-col gap-1 sm:w-56">
          <UButton
            v-for="file in files"
            :key="file.id"
            color="neutral"
            :variant="selected === file.id ? 'subtle' : 'ghost'"
            class="justify-start font-mono text-xs"
            :label="file.path"
            :disabled="!canReveal"
            @click="select(file.id)"
          />
          <p
            v-if="!files.length"
            class="px-1 text-sm text-muted"
          >
            {{ t('appFiles.empty') }}
          </p>
          <UButton
            v-if="editable"
            icon="i-lucide-plus"
            variant="ghost"
            class="mt-1 justify-start"
            :label="t('appFiles.new')"
            @click="startNew"
          />
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-3">
          <template v-if="selected">
            <UInput
              v-model="draft.path"
              class="w-full font-mono"
              :disabled="!editable"
              :placeholder="t('appFiles.path')"
            />
            <UTextarea
              v-model="draft.content"
              :rows="14"
              spellcheck="false"
              class="w-full"
              :disabled="!editable"
              :ui="{ base: 'font-mono text-sm' }"
            />
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                v-if="editable"
                :loading="saving"
                :label="t('common.save')"
                @click="save"
              />
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="outline"
                :label="t('common.copy')"
                @click="copy(draft.content)"
              />
              <UButton
                v-if="editable && selected !== 'new'"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                class="ml-auto"
                :label="t('common.delete')"
                @click="remove"
              />
            </div>
          </template>
          <p
            v-else
            class="rounded-lg border border-dashed border-accented p-6 text-center text-sm text-muted"
          >
            {{ canReveal ? t('appFiles.select') : t('appFiles.noAccess') }}
          </p>
        </div>
      </div>
    </template>
  </UModal>
</template>
