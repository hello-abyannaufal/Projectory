<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  projectId: string
  apps: { id: string, name: string }[]
  environments: { id: string, name: string }[]
  link?: { id: string, type: LinkType, label: string, url: string, appId: string | null, environmentId: string | null }
  defaultAppId?: string | null
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const PROJECT_SCOPE = 'project'
const ANY_ENVIRONMENT = 'any'

const state = reactive({ type: 'repository' as LinkType, label: '', url: '', scope: PROJECT_SCOPE, environment: ANY_ENVIRONMENT })

watch(open, (value) => {
  if (value) {
    Object.assign(state, {
      type: props.link?.type ?? 'repository',
      label: props.link?.label ?? '',
      url: props.link?.url ?? '',
      scope: props.link?.appId ?? props.defaultAppId ?? PROJECT_SCOPE,
      environment: props.link?.environmentId ?? ANY_ENVIRONMENT
    })
  }
})

const typeItems = computed(() => LINK_TYPES.map(value => ({ value, label: t(`linkType.${value}`) })))
const scopeItems = computed(() => [
  { value: PROJECT_SCOPE, label: t('links.wholeProject') },
  ...props.apps.map(app => ({ value: app.id, label: app.name }))
])
const environmentItems = computed(() => [
  { value: ANY_ENVIRONMENT, label: t('links.anyEnvironment') },
  ...props.environments.map(environment => ({ value: environment.id, label: environment.name }))
])

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof linkInput>>) {
  const body = {
    ...data,
    appId: state.scope === PROJECT_SCOPE ? null : state.scope,
    environmentId: state.environment === ANY_ENVIRONMENT ? null : state.environment
  }
  loading.value = true
  const saved = await api(() => props.link
    ? request(`/api/links/${props.link.id}`, { method: 'PATCH', body })
    : request(`/api/projects/${props.projectId}/links`, { method: 'POST', body }))
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
    :title="link ? t('links.edit') : t('links.new')"
  >
    <template #body>
      <UForm
        id="link-form"
        :schema="linkInput"
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
            :label="t('links.belongsTo')"
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
          :label="t('links.environment')"
          :description="t('links.environmentHint')"
          name="environment"
        >
          <USelect
            v-model="state.environment"
            :items="environmentItems"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="t('fields.label')"
          name="label"
          required
        >
          <UInput
            v-model="state.label"
            class="w-full"
            :placeholder="t('links.labelPlaceholder')"
          />
        </UFormField>
        <UFormField
          label="URL"
          name="url"
          required
        >
          <UInput
            v-model="state.url"
            type="url"
            class="w-full"
            placeholder="https://"
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
          form="link-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
