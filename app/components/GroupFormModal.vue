<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  group?: Group
}>()

const emit = defineEmits<{ saved: [] }>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()
const { can } = usePermissions()

const state = reactive({ name: '', description: '', accessCode: '' })
// Only chosen when creating; whoever can't manage shared groups only has private ones.
const isPrivate = ref(false)
const privateGroup = computed(() => props.group ? props.group.isPrivate : isPrivate.value)
// The stored code, so an edit only sends accessCode when it changed.
const storedCode = ref('')
const codeVisible = ref(false)

watch(open, async (value) => {
  if (!value) {
    return
  }
  codeVisible.value = false
  storedCode.value = ''
  isPrivate.value = !can('manageGroups')
  Object.assign(state, {
    name: props.group?.name ?? '',
    description: props.group?.description ?? '',
    accessCode: ''
  })
  if (props.group?.hasAccessCode) {
    const { accessCode } = await request<{ accessCode: string | null }>(`/api/groups/${props.group.id}/access-code`)
    storedCode.value = accessCode ?? ''
    state.accessCode = storedCode.value
  }
})

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof groupInput>>) {
  loading.value = true
  try {
    if (props.group) {
      const { accessCode, ...rest } = data
      const body = (accessCode ?? '') === storedCode.value ? rest : data
      await request(`/api/groups/${props.group.id}`, { method: 'PATCH', body })
    } else {
      await request('/api/groups', { method: 'POST', body: { ...data, isPrivate: isPrivate.value } })
    }
    open.value = false
    emit('saved')
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
    :title="group ? t('groups.edit') : t('groups.new')"
  >
    <template #body>
      <UForm
        id="group-form"
        :schema="groupInput"
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
            autofocus
          />
        </UFormField>
        <UFormField
          :label="t('fields.description')"
          name="description"
        >
          <UTextarea
            v-model="state.description"
            class="w-full"
            :rows="2"
            autoresize
          />
        </UFormField>
        <USwitch
          v-if="!group && can('manageGroups')"
          v-model="isPrivate"
          :label="t('groups.privateSwitch')"
          :description="t('groups.privateHint')"
        />
        <p
          v-else-if="privateGroup"
          class="flex items-center gap-2 text-sm text-muted"
        >
          <UIcon
            name="i-lucide-user-lock"
            class="size-4 shrink-0"
          />
          {{ t('groups.privateHint') }}
        </p>
        <UFormField
          v-if="!privateGroup"
          :label="t('groups.accessCode')"
          :description="t('groups.accessCodeHint')"
          name="accessCode"
        >
          <UInput
            v-model="state.accessCode"
            :type="codeVisible ? 'text' : 'password'"
            autocomplete="off"
            class="w-full"
            :ui="{ trailing: 'pe-1' }"
          >
            <template #trailing>
              <UButton
                :icon="codeVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                color="neutral"
                variant="link"
                size="sm"
                :aria-label="codeVisible ? t('common.hide') : t('common.reveal')"
                @click="codeVisible = !codeVisible"
              />
            </template>
          </UInput>
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
          form="group-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
