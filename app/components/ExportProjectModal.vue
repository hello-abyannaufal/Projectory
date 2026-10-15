<script setup lang="ts">
const props = defineProps<{
  projectId: string
  projectName: string
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()
const copy = useCopy()
const { can } = usePermissions()

type Format = 'zip' | 'markdown'
type Secrets = 'none' | 'passphrase' | 'plaintext'

const format = ref<Format>('zip')
const secrets = ref<Secrets>('none')
const passphrase = ref('')
const confirmPassphrase = ref('')
const loading = ref(false)

watch(open, (value) => {
  if (value) {
    format.value = 'zip'
    secrets.value = 'none'
    passphrase.value = ''
    confirmPassphrase.value = ''
  }
})
watch(format, () => {
  secrets.value = 'none'
})

const formatOptions = computed(() => [
  { value: 'zip' as const, title: t('export.zipTitle'), description: t('export.zipDescription') },
  { value: 'markdown' as const, title: t('export.textTitle'), description: t('export.textDescription') }
])

// Without viewSecrets only the export without secrets is offered (and allowed by the server).
const secretOptions = computed(() => (format.value === 'zip'
  ? [
      { value: 'none' as const, title: t('export.withoutSecrets'), description: t('export.withoutSecretsZip') },
      { value: 'passphrase' as const, title: t('export.encrypted'), description: t('export.encryptedDescription') }
    ]
  : [
      { value: 'none' as const, title: t('export.withoutSecrets'), description: t('export.withoutSecretsText') },
      { value: 'plaintext' as const, title: t('export.plaintext'), description: t('export.plaintextDescription') }
    ]).filter(option => option.value === 'none' || can('viewSecrets')))

const passphraseError = computed(() => {
  if (secrets.value !== 'passphrase') {
    return undefined
  }
  if (passphrase.value.length < 8) {
    return t('export.passphraseMin')
  }
  return passphrase.value !== confirmPassphrase.value ? t('validation.passwordMismatch') : undefined
})

async function run() {
  if (passphraseError.value) {
    return
  }
  loading.value = true
  try {
    const response = await fetch(`/api/projects/${props.projectId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: format.value, secrets: secrets.value, passphrase: passphrase.value || undefined })
    })
    if (!response.ok) {
      throw new Error(response.statusText)
    }
    if (format.value === 'markdown') {
      await copy(await response.text())
    } else {
      const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'project.projectory.zip'
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      URL.revokeObjectURL(url)
    }
    open.value = false
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('export.title')"
    :description="projectName"
  >
    <template #body>
      <div class="flex flex-col gap-5">
        <fieldset class="flex flex-col gap-2">
          <legend class="mb-2 text-sm font-semibold text-default">
            {{ t('export.format') }}
          </legend>
          <ChoiceCard
            v-for="option in formatOptions"
            :key="option.value"
            :selected="format === option.value"
            :title="option.title"
            :description="option.description"
            @select="format = option.value"
          />
        </fieldset>

        <fieldset class="flex flex-col gap-2">
          <legend class="mb-2 text-sm font-semibold text-default">
            {{ t('export.secrets') }}
          </legend>
          <ChoiceCard
            v-for="option in secretOptions"
            :key="option.value"
            :selected="secrets === option.value"
            :title="option.title"
            :description="option.description"
            @select="secrets = option.value"
          />
        </fieldset>

        <div
          v-if="secrets === 'passphrase'"
          class="flex flex-col gap-3"
        >
          <UFormField :label="t('export.passphrase')">
            <UInput
              v-model="passphrase"
              type="password"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('export.confirmPassphrase')"
            :error="confirmPassphrase && passphraseError"
          >
            <UInput
              v-model="confirmPassphrase"
              type="password"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :description="t('export.passphraseWarning')"
          />
        </div>

        <UAlert
          v-if="secrets === 'plaintext'"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="t('export.plaintextWarning')"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="t('common.cancel')"
          @click="open = false"
        />
        <UButton
          :icon="format === 'zip' ? 'i-lucide-download' : 'i-lucide-copy'"
          :loading="loading"
          :disabled="!!passphraseError"
          :label="format === 'zip' ? t('export.download') : t('export.copyText')"
          @click="run"
        />
      </div>
    </template>
  </UModal>
</template>
