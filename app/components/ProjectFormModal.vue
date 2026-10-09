<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  project?: { id: string, name: string, description: string | null, status: ProjectStatus }
}>()

const emit = defineEmits<{ saved: [id: string] }>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()

const state = reactive({ name: '', description: '', status: 'active' as ProjectStatus })

watch(open, (value) => {
  if (value) {
    Object.assign(state, {
      name: props.project?.name ?? '',
      description: props.project?.description ?? '',
      status: props.project?.status ?? 'active'
    })
  }
})

const statusItems = computed(() => PROJECT_STATUSES.map(value => ({ value, label: t(`projectStatus.${value}`) })))

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof projectInput>>) {
  loading.value = true
  try {
    const saved = props.project
      ? await request<{ id: string }>(`/api/projects/${props.project.id}`, { method: 'PATCH', body: data })
      : await request<{ id: string }>('/api/projects', { method: 'POST', body: data })
    open.value = false
    emit('saved', saved.id)
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
    :title="project ? t('projects.edit') : t('projects.new')"
  >
    <template #body>
      <UForm
        id="project-form"
        :schema="projectInput"
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
            :rows="3"
            autoresize
          />
        </UFormField>
        <UFormField
          :label="t('fields.status')"
          name="status"
        >
          <USelect
            v-model="state.status"
            :items="statusItems"
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
          form="project-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
