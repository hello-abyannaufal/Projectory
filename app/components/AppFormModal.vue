<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  projectId: string
  app?: ProjectApp
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()
const { data: techStacks, refresh: refreshStacks } = useTechStacks()

const state = reactive({
  name: '',
  description: '',
  platforms: [] as Platform[],
  techStackIds: [] as string[],
  notes: null as Record<string, unknown> | null
})

watch(open, (value) => {
  if (value) {
    refreshStacks()
    Object.assign(state, {
      name: props.app?.name ?? '',
      description: props.app?.description ?? '',
      platforms: [...(props.app?.platforms ?? [])],
      techStackIds: props.app?.techStacks.map(stack => stack.id) ?? [],
      notes: asDoc(props.app?.notes)
    })
  }
})

const platformItems = computed(() => PLATFORMS.map(value => ({ value, label: t(`platform.${value}`) })))
const stackItems = computed(() => techStacks.value.map(stack => ({ value: stack.id, label: stack.name, stack })))

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof appInput>>) {
  const body = { ...data, notes: state.notes }
  loading.value = true
  const url: string = props.app ? `/api/apps/${props.app.id}` : `/api/projects/${props.projectId}/apps`
  const saved = await api(() => request(url, { method: props.app ? 'PATCH' : 'POST', body }))
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
    :title="app ? t('apps.edit') : t('apps.new')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <UForm
        id="app-form"
        :schema="appInput"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          :label="t('fields.name')"
          name="name"
          :hint="t('apps.nameHint')"
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
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('fields.platforms')"
            name="platforms"
          >
            <USelectMenu
              v-model="state.platforms"
              :items="platformItems"
              value-key="value"
              multiple
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('nav.techStacks')"
            name="techStackIds"
          >
            <USelectMenu
              v-model="state.techStackIds"
              :items="stackItems"
              value-key="value"
              multiple
              class="w-full"
            >
              <template #item-leading="{ item }">
                <TechStackIcon :stack="item.stack" />
              </template>
            </USelectMenu>
          </UFormField>
        </div>
        <UFormField
          :label="t('fields.notes')"
          name="notes"
          :help="t('notes.warning')"
        >
          <RichTextEditor v-model="state.notes" />
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
          form="app-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
