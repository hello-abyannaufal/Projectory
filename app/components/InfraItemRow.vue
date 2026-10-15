<script setup lang="ts">
defineProps<{
  item: { type: InfraType, name: string, host: string, notes: string | null }
  // Environment name, or null when shared by every environment; omitted to hide it
  scope?: string | null
  editable?: boolean
}>()

const emit = defineEmits<{ edit: [], delete: [] }>()

const { t } = useI18n()
const copy = useCopy()
</script>

<template>
  <div class="flex items-start gap-3 rounded-lg border border-default bg-default px-4 py-2.5">
    <UTooltip :text="t(`infraType.${item.type}`)">
      <UIcon
        :name="infraTypeIcon[item.type]"
        class="mt-1 size-4 shrink-0 text-muted"
      />
    </UTooltip>
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <div class="flex flex-wrap items-center gap-x-2">
        <span class="text-sm font-medium text-highlighted">{{ item.name }}</span>
        <UBadge
          v-if="scope !== undefined"
          color="neutral"
          variant="soft"
          size="sm"
          :label="scope ?? t('infra.allEnvironments')"
        />
      </div>
      <div class="flex min-w-0 items-center gap-1">
        <a
          v-if="isHttpUrl(item.host)"
          :href="item.host"
          target="_blank"
          rel="noopener noreferrer"
          class="truncate font-mono text-sm text-primary hover:underline"
        >{{ item.host }}</a>
        <code
          v-else
          class="truncate font-mono text-sm text-toned"
        >{{ item.host }}</code>
        <UButton
          icon="i-lucide-copy"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="t('common.copy')"
          @click="copy(item.host)"
        />
      </div>
      <p
        v-if="item.notes"
        class="text-xs whitespace-pre-line text-muted"
      >
        {{ item.notes }}
      </p>
    </div>
    <template v-if="editable">
      <UButton
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        :aria-label="t('common.edit')"
        @click="emit('edit')"
      />
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :aria-label="t('common.delete')"
        @click="emit('delete')"
      />
    </template>
  </div>
</template>
