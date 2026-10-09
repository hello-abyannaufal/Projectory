<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  deploymentId: string
  release?: DeploymentRelease
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const state = reactive({
  type: 'web_url' as ReleaseType,
  version: '',
  buildNumber: '',
  url: '',
  releasedAt: '',
  changelog: '',
  status: 'released' as ReleaseStatus
})

watch(open, (value) => {
  if (value) {
    const release = props.release
    Object.assign(state, {
      type: release?.type ?? 'web_url',
      version: release?.version ?? '',
      buildNumber: release?.buildNumber ?? '',
      url: release?.url ?? '',
      releasedAt: release?.releasedAt ?? new Date().toISOString().slice(0, 10),
      changelog: release?.changelog ?? '',
      status: release?.status ?? 'released'
    })
  }
})

const typeItems = computed(() => RELEASE_TYPES.map(value => ({ value, label: t(`releaseType.${value}`) })))
const statusItems = computed(() => RELEASE_STATUSES.map(value => ({ value, label: t(`releaseStatus.${value}`) })))

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof releaseInput>>) {
  loading.value = true
  const url = props.release ? `/api/releases/${props.release.id}` : `/api/deployments/${props.deploymentId}/releases`
  const saved = await api(() => request(url, { method: props.release ? 'PATCH' : 'POST', body: data }))
  loading.value = false
  if (saved) {
    open.value = false
    emit('saved')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="release ? t('releases.edit') : t('releases.new')"
  >
    <template #body>
      <UForm
        id="release-form"
        :schema="releaseInput"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('releases.version')"
            name="version"
            required
          >
            <UInput
              v-model="state.version"
              class="w-full"
              placeholder="v1.0.0"
              autofocus
            />
          </UFormField>
          <UFormField
            :label="t('releases.buildNumber')"
            name="buildNumber"
          >
            <UInput
              v-model="state.buildNumber"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('fields.type')"
            name="type"
          >
            <USelect
              v-model="state.type"
              :items="typeItems"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('fields.status')"
            name="status"
          >
            <USelect
              v-model="state.status"
              :items="statusItems"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="URL"
            name="url"
            class="sm:col-span-2"
          >
            <UInput
              v-model="state.url"
              type="url"
              class="w-full"
              placeholder="https://"
            />
          </UFormField>
          <UFormField
            :label="t('releases.releasedAt')"
            name="releasedAt"
          >
            <UInput
              v-model="state.releasedAt"
              type="date"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          :label="t('releases.changelog')"
          name="changelog"
        >
          <UTextarea
            v-model="state.changelog"
            class="w-full"
            :rows="3"
            autoresize
          />
        </UFormField>
      </UForm>
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
          type="submit"
          form="release-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
