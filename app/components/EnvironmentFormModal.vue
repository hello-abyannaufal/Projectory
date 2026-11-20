<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  projectId: string
  groupId?: string
  environment?: ProjectEnvironment
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const state = reactive<z.input<typeof environmentInput>>({ name: '', isProduction: false })
const vpnIds = ref<string[]>([])
const groupVpns = ref<{ id: string, name: string }[]>([])

watch(open, async (value) => {
  if (value) {
    Object.assign(state, { name: props.environment?.name ?? '', isProduction: props.environment?.isProduction ?? false })
    vpnIds.value = props.environment?.vpns.map(vpn => vpn.id) ?? []
    groupVpns.value = props.groupId
      ? await api(() => request<{ id: string, name: string }[]>('/api/group-vpns', { query: { groupId: props.groupId } })) ?? []
      : []
  }
})

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof environmentInput>>) {
  loading.value = true
  const body = { ...data, vpnIds: vpnIds.value }
  const saved = await api(() => props.environment
    ? request(`/api/environments/${props.environment.id}`, { method: 'PATCH', body })
    : request(`/api/projects/${props.projectId}/environments`, { method: 'POST', body }))
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
        <UFormField
          :label="t('groupVpn.environments')"
          :description="groupVpns.length ? t('groupVpn.environmentsHint') : t('groupVpn.noVpns')"
        >
          <USelectMenu
            v-model="vpnIds"
            :items="groupVpns"
            value-key="id"
            label-key="name"
            multiple
            :disabled="!groupVpns.length"
            :placeholder="t('groupVpn.environmentsPlaceholder')"
            class="w-full"
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
          form="environment-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
