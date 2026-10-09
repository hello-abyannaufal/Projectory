<script setup lang="ts">
const props = defineProps<{
  deploymentId: string
  account?: DeploymentAccount
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

interface FieldRow {
  id?: string
  key: string
  value: string
  isSecret: boolean
  // Existing secret whose stored value is kept when left empty
  stored: boolean
}

const state = reactive({
  label: '',
  description: '',
  tags: [] as string[],
  status: 'active' as TestAccountStatus,
  fields: [] as FieldRow[]
})

watch(open, (value) => {
  if (!value) {
    return
  }
  const account = props.account
  Object.assign(state, {
    label: account?.label ?? '',
    description: account?.description ?? '',
    tags: [...(account?.tags ?? [])],
    status: account?.status ?? 'active',
    fields: account
      ? account.fields.map(field => ({ id: field.id, key: field.key, value: field.value ?? '', isSecret: field.isSecret, stored: field.isSecret }))
      : [
          { key: 'Username', value: '', isSecret: false, stored: false },
          { key: 'Password', value: '', isSecret: true, stored: false }
        ]
  })
})

const statusItems = computed(() => TEST_ACCOUNT_STATUSES.map(value => ({ value, label: t(`accountStatus.${value}`) })))

function addField() {
  state.fields.push({ key: '', value: '', isSecret: false, stored: false })
}

const loading = ref(false)

async function onSubmit() {
  const body = {
    label: state.label,
    description: state.description,
    tags: state.tags,
    status: state.status,
    fields: state.fields
      .filter(field => field.key.trim())
      .map(field => ({
        id: field.id,
        key: field.key,
        isSecret: field.isSecret,
        value: field.isSecret && field.stored && field.value === '' ? null : field.value
      }))
  }
  const parsed = testAccountInput.safeParse(body)
  if (!parsed.success) {
    useToast().add({ title: t('validation.required'), description: parsed.error.issues[0]?.path.join('.'), color: 'error' })
    return
  }
  loading.value = true
  const url = props.account ? `/api/accounts/${props.account.id}` : `/api/deployments/${props.deploymentId}/accounts`
  const saved = await api(() => request(url, { method: props.account ? 'PATCH' : 'POST', body }))
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
    :title="account ? t('accounts.edit') : t('accounts.new')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form
        id="account-form"
        class="space-y-4"
        @submit.prevent="onSubmit"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('fields.label')"
            required
          >
            <UInput
              v-model="state.label"
              class="w-full"
              :placeholder="t('accounts.labelPlaceholder')"
              autofocus
            />
          </UFormField>
          <UFormField :label="t('fields.status')">
            <USelect
              v-model="state.status"
              :items="statusItems"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          :label="t('accounts.tags')"
          :hint="t('accounts.tagsHint')"
        >
          <UInputTags
            v-model="state.tags"
            add-on-blur
            add-on-paste
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('fields.description')">
          <UInput
            v-model="state.description"
            class="w-full"
          />
        </UFormField>

        <fieldset class="space-y-2">
          <legend class="mb-2 text-sm font-medium text-default">
            {{ t('accounts.fields') }}
          </legend>
          <div
            v-for="(field, index) in state.fields"
            :key="index"
            class="flex flex-wrap items-center gap-2 sm:flex-nowrap"
          >
            <UInput
              v-model="field.key"
              :placeholder="t('accounts.fieldKey')"
              :aria-label="t('accounts.fieldKey')"
              class="w-full sm:w-40"
            />
            <UInput
              v-model="field.value"
              :type="field.isSecret ? 'password' : 'text'"
              :placeholder="field.stored ? t('accounts.keepSecret') : t('accounts.fieldValue')"
              :aria-label="t('accounts.fieldValue')"
              autocomplete="new-password"
              class="min-w-0 flex-1"
            />
            <UCheckbox
              v-model="field.isSecret"
              :label="t('accounts.secret')"
            />
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              :aria-label="t('common.delete')"
              @click="state.fields.splice(index, 1)"
            />
          </div>
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            :label="t('accounts.addField')"
            @click="addField"
          />
        </fieldset>
      </form>
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
          form="account-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
