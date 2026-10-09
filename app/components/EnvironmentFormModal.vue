<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  projectId: string
  environment?: ProjectEnvironment
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const state = reactive<z.input<typeof environmentInput>>({ name: '', isProduction: false })

watch(open, (value) => {
  if (value) {
    Object.assign(state, { name: props.environment?.name ?? '', isProduction: props.environment?.isProduction ?? false })
  }
})

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof environmentInput>>) {
  loading.value = true
  const saved = await api(() => props.environment
    ? request(`/api/environments/${props.environment.id}`, { method: 'PATCH', body: data })
    : request(`/api/projects/${props.projectId}/environments`, { method: 'POST', body: data }))
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
    :title="environment ? t('environments.edit') : t('environments.new')"
  >
    <template #body>
      <UForm
        id="environment-form"
        :schema="environmentInput"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          :label="t('fields.name')"
          name="name"
          :hint="t('environments.nameHint')"
          required
        >
          <UInput
            v-model="state.name"
            class="w-full"
            autofocus
          />
        </UFormField>
        <USwitch
          v-model="state.isProduction"
          :label="t('environments.isProduction')"
          :description="t('environments.isProductionHint')"
        />
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
          form="environment-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
