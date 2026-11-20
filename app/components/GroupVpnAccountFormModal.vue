<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  vpn?: { id: string, name: string, account: { username: string, hasPassword: boolean, notes: string | null } | null }
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const state = reactive({ username: '', password: '', notes: '' })
const showPassword = ref(false)

watch(open, async (value) => {
  if (!value) {
    return
  }
  const account = props.vpn?.account
  Object.assign(state, { username: account?.username ?? '', password: '', notes: account?.notes ?? '' })
  showPassword.value = false
  // Editing starts from the stored password so it can be changed or kept as is.
  if (account?.hasPassword) {
    const result = await api(() => request<{ password: string }>(`/api/group-vpns/${props.vpn!.id}/account/password`))
    state.password = result?.password ?? ''
  }
})

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof groupVpnAccountInput>>) {
  if (!props.vpn) {
    return
  }
  loading.value = true
  const saved = await api(() => request(`/api/group-vpns/${props.vpn!.id}/account`, { method: 'PUT', body: data }))
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
    :title="t('groupVpn.accountTitle', { name: vpn?.name ?? '' })"
    :description="t('groupVpn.accountDescription')"
  >
    <template #body>
      <UForm
        id="group-vpn-account-form"
        :schema="groupVpnAccountInput"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          :label="t('groupVpn.username')"
          name="username"
          required
        >
          <UInput
            v-model="state.username"
            class="w-full"
            autocomplete="off"
          />
        </UFormField>
        <UFormField
          :label="t('groupVpn.password')"
          name="password"
        >
          <UInput
            v-model="state.password"
            :type="showPassword ? 'text' : 'password'"
            class="w-full"
            autocomplete="new-password"
          >
            <template #trailing>
              <UButton
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                color="neutral"
                variant="link"
                size="sm"
                :aria-label="showPassword ? t('groupVpn.hidePassword') : t('groupVpn.showPassword')"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>
        <UFormField
          :label="t('fields.notes')"
          name="notes"
        >
          <UTextarea
            v-model="state.notes"
            :rows="3"
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
          form="group-vpn-account-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
