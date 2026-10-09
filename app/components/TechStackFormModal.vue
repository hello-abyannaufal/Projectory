<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  stack?: TechStack
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const state = reactive({ name: '', category: 'other' as TechCategory, color: '1E3A8A' })
const logoFile = ref<File>()
const logoPreview = ref<string>()

watch(open, (value) => {
  if (value) {
    Object.assign(state, {
      name: props.stack?.name ?? '',
      category: props.stack?.category ?? 'other',
      color: props.stack?.color ?? '1E3A8A'
    })
    logoFile.value = undefined
    logoPreview.value = uploadUrl(props.stack?.logo)
  }
})

const colorHex = computed({
  get: () => `#${state.color}`,
  set: (value: string) => {
    state.color = value.replace('#', '').toUpperCase()
  }
})

const categoryItems = computed(() => TECH_CATEGORIES.map(value => ({ value, label: t(`techCategory.${value}`) })))

function onLogo(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    logoFile.value = file
    logoPreview.value = URL.createObjectURL(file)
  }
}

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof techStackInput>>) {
  loading.value = true
  const url = props.stack ? `/api/tech-stacks/${props.stack.id}` : '/api/tech-stacks'
  const saved = await api(() => request<{ id: string }>(url, { method: props.stack ? 'PATCH' : 'POST', body: data }))
  if (saved && logoFile.value) {
    const body = new FormData()
    body.append('file', logoFile.value)
    await api(() => request(`/api/tech-stacks/${saved.id}/logo`, { method: 'POST', body }))
  }
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
    :title="stack ? t('techStacks.edit') : t('techStacks.newCustom')"
  >
    <template #body>
      <UForm
        id="stack-form"
        :schema="techStackInput"
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
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('techStacks.category')"
            name="category"
          >
            <USelect
              v-model="state.category"
              :items="categoryItems"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('techStacks.color')"
            name="color"
          >
            <div class="flex items-center gap-2">
              <input
                v-model="colorHex"
                type="color"
                :aria-label="t('techStacks.color')"
                class="size-9 shrink-0 cursor-pointer rounded-md border border-default bg-default p-0.5"
              >
              <UInput
                v-model="state.color"
                class="min-w-0 flex-1 font-mono"
                :maxlength="6"
              >
                <template #leading>
                  <span class="text-muted">#</span>
                </template>
              </UInput>
            </div>
          </UFormField>
        </div>
        <UFormField :label="t('techStacks.logo')">
          <label class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-accented bg-elevated/40 p-3">
            <img
              v-if="logoPreview"
              :src="logoPreview"
              alt=""
              class="size-10 rounded-lg object-contain"
            >
            <TechStackIcon
              v-else
              :stack="{ name: state.name || '?', color: state.color }"
              size="lg"
            />
            <span class="flex flex-col">
              <span class="text-sm font-semibold text-primary underline">{{ t('techStacks.uploadLogo') }}</span>
              <span class="text-xs text-muted">{{ t('techStacks.logoHint') }}</span>
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              class="sr-only"
              @change="onLogo"
            >
          </label>
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
          form="stack-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
