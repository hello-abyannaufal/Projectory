<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  groupId?: string
  vpn?: { id: string, name: string, host: string, notes: string | null }
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const state = reactive({ name: '', host: '', notes: '' })

watch(open, (value) => {
  if (value) {
    Object.assign(state, {
      name: props.vpn?.name ?? '',
      host: props.vpn?.host ?? '',
      notes: props.vpn?.notes ?? ''
    })
  }
})

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof groupVpnInput>>) {
  loading.value = true
  const saved = await api(() => props.vpn
    ? request(`/api/group-vpns/${props.vpn.id}`, { method: 'PATCH', body: data })
    : request('/api/group-vpns', { method: 'POST', body: { ...data, groupId: props.groupId } }))
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
    :title="vpn ? t('groupVpn.edit') : t('groupVpn.new')"
    :description="t('infra.noSecrets')"
  >
    <template #body>
      <UForm
        id="group-vpn-form"
        :schema="groupVpnInput"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          :label="t('fields.name')"
          name="name"
          required
        >
          <UInput
            v-model="state.name"
            class="w-full"
            :placeholder="t('groupVpn.namePlaceholder')"
          />
        </UFormField>
        <UFormField
          :label="t('infra.host')"
          :description="t('groupVpn.hostHint')"
          name="host"
          required
        >
          <UInput
            v-model="state.host"
            class="w-full font-mono"
            placeholder="vpn.bank.local"
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
            :placeholder="t('groupVpn.notesPlaceholder')"
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
          form="group-vpn-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
