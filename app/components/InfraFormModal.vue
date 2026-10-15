<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  projectId: string
  environments: { id: string, name: string }[]
  item?: { id: string, type: InfraType, name: string, host: string, environmentId: string | null, notes: string | null }
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const ALL_ENVIRONMENTS = 'all'

const state = reactive({ type: 'server' as InfraType, name: '', host: '', scope: ALL_ENVIRONMENTS, notes: '' })

watch(open, (value) => {
  if (value) {
    Object.assign(state, {
      type: props.item?.type ?? 'server',
      name: props.item?.name ?? '',
      host: props.item?.host ?? '',
      scope: props.item?.environmentId ?? ALL_ENVIRONMENTS,
      notes: props.item?.notes ?? ''
    })
  }
})

const typeItems = computed(() => INFRA_TYPES.map(value => ({ value, label: t(`infraType.${value}`), icon: infraTypeIcon[value] })))
const scopeItems = computed(() => [
  { value: ALL_ENVIRONMENTS, label: t('infra.allEnvironments') },
  ...props.environments.map(environment => ({ value: environment.id, label: environment.name }))
])

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof infraInput>>) {
  const body = { ...data, environmentId: state.scope === ALL_ENVIRONMENTS ? null : state.scope }
  loading.value = true
  const saved = await api(() => props.item
    ? request(`/api/infra/${props.item.id}`, { method: 'PATCH', body })
    : request(`/api/projects/${props.projectId}/infra`, { method: 'POST', body }))
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
    :title="item ? t('infra.edit') : t('infra.new')"
    :description="t('infra.noSecrets')"
  >
    <template #body>
      <UForm
        id="infra-form"
        :schema="infraInput"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid gap-4 sm:grid-cols-2">
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
            :label="t('infra.environment')"
            name="scope"
          >
            <USelect
              v-model="state.scope"
              :items="scopeItems"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          :label="t('fields.name')"
          name="name"
          required
        >
          <UInput
            v-model="state.name"
            class="w-full"
            :placeholder="t('infra.namePlaceholder')"
          />
        </UFormField>
        <UFormField
          :label="t('infra.host')"
          :description="t('infra.hostHint')"
          name="host"
          required
        >
          <UInput
            v-model="state.host"
            class="w-full font-mono"
            placeholder="10.20.1.15"
          />
        </UFormField>
        <UFormField
          :label="t('fields.notes')"
          name="notes"
        >
          <UTextarea
            v-model="state.notes"
            :rows="3"
            class="w-full"
            :placeholder="t('infra.notesPlaceholder')"
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
          form="infra-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
