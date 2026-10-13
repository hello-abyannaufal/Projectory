<script setup lang="ts">
const props = defineProps<{
  account: DeploymentAccount
  // Fetches (and caches) decrypted secret values by field id
  loadSecrets: () => Promise<Record<string, string> | undefined>
  // Attributes from useDragSort().handle(), bound on the grip
  dragHandle?: Record<string, unknown>
  // Show the edit/delete menu
  editable?: boolean
  // Allow revealing and copying secret fields
  canReveal?: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
  verify: []
}>()

const { t, locale } = useI18n()
const copy = useCopy()

const secrets = ref<Record<string, string>>()
const shown = ref(new Set<string>())

async function toggle(fieldId: string) {
  secrets.value ??= await props.loadSecrets()
  const next = new Set(shown.value)
  if (next.has(fieldId)) {
    next.delete(fieldId)
  } else {
    next.add(fieldId)
  }
  shown.value = next
}

function display(field: DeploymentAccount['fields'][number]) {
  if (!field.isSecret) {
    return field.value
  }
  return shown.value.has(field.id) && secrets.value ? secrets.value[field.id] ?? '' : SECRET_MASK
}

async function copyField(field: DeploymentAccount['fields'][number]) {
  if (!field.isSecret) {
    return copy(field.value ?? '')
  }
  secrets.value ??= await props.loadSecrets()
  if (secrets.value) {
    await copy(secrets.value[field.id] ?? '')
  }
}

// Secrets change after an edit; drop the local copy.
watch(() => props.account, () => {
  secrets.value = undefined
  shown.value = new Set()
})

const menu = computed(() => [[
  { label: t('accounts.markVerified'), icon: 'i-lucide-badge-check', onSelect: () => emit('verify') },
  { label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => emit('edit') }
], [
  { label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => emit('delete') }
]])
</script>

<template>
  <article class="flex flex-col gap-3 rounded-lg border border-default bg-default p-4">
    <div class="flex items-start justify-between gap-2">
      <div class="flex min-w-0 flex-col gap-1.5">
        <h3 class="font-semibold text-highlighted">
          {{ account.label }}
        </h3>
        <div class="flex flex-wrap gap-1.5">
          <UBadge
            v-for="tag in account.tags"
            :key="tag"
            color="secondary"
            variant="subtle"
            size="sm"
            :label="tag"
          />
          <UBadge
            :color="testAccountStatusColor[account.status]"
            variant="subtle"
            size="sm"
            :label="t(`accountStatus.${account.status}`)"
          />
        </div>
      </div>
      <div class="flex shrink-0 items-center">
        <UIcon
          v-if="dragHandle"
          v-bind="dragHandle"
          name="i-lucide-grip-vertical"
          :aria-label="t('common.reorder')"
          class="size-4 cursor-grab text-dimmed"
        />
        <UDropdownMenu
          v-if="editable"
          :items="menu"
        >
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            :aria-label="t('common.more')"
          />
        </UDropdownMenu>
      </div>
    </div>

    <p
      v-if="account.description"
      class="text-sm text-muted"
    >
      {{ account.description }}
    </p>

    <div
      v-if="account.fields.length"
      class="divide-y divide-default rounded-md border border-default"
    >
      <div
        v-for="field in account.fields"
        :key="field.id"
        class="flex items-center gap-2 py-1 pr-1 pl-3"
      >
        <span class="w-24 shrink-0 truncate text-xs text-muted">{{ field.key }}</span>
        <span class="min-w-0 flex-1 truncate font-mono text-sm text-highlighted">{{ display(field) }}</span>
        <UButton
          v-if="field.isSecret && canReveal"
          :icon="shown.has(field.id) ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="shown.has(field.id) ? t('common.hide') : t('common.reveal')"
          @click="toggle(field.id)"
        />
        <UButton
          v-if="!field.isSecret || canReveal"
          icon="i-lucide-copy"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="t('common.copy')"
          @click="copyField(field)"
        />
      </div>
    </div>

    <span class="text-xs text-muted">
      {{ account.lastVerifiedAt ? t('accounts.verifiedAgo', { time: timeAgo(account.lastVerifiedAt, locale) }) : t('accounts.neverVerified') }}
    </span>
  </article>
</template>
