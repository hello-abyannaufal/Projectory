<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  deployment: { id: string, url: string | null, branch: string | null }
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const schema = deploymentInput.pick({ url: true, branch: true })
const state = reactive({ url: '', branch: '' })

watch(open, (value) => {
  if (value) {
    Object.assign(state, { url: props.deployment.url ?? '', branch: props.deployment.branch ?? '' })
  }
})

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof schema>>) {
  loading.value = true
  const saved = await api(() => request(`/api/deployments/${props.deployment.id}`, { method: 'PATCH', body: data }))
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
    :title="t('deployments.edit')"
  >
    <template #body>
      <UForm
        id="deployment-form"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          label="URL"
          name="url"
        >
          <UInput
            v-model="state.url"
            type="url"
            class="w-full"
            placeholder="https://"
            autofocus
          />
        </UFormField>
        <UFormField
          :label="t('deployments.branch')"
          name="branch"
        >
          <UInput
            v-model="state.branch"
            class="w-full"
            placeholder="release/uat"
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
          form="deployment-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
