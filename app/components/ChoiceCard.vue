<script setup lang="ts">
defineProps<{
  selected: boolean
  title: string
  description?: string
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    role="radio"
    :aria-checked="selected"
    :class="[
      'flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition',
      selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-default hover:border-accented'
    ]"
    @click="$emit('select')"
  >
    <span
      :class="[
        'mt-0.5 size-4 shrink-0 rounded-full border-2',
        selected ? 'border-[5px] border-primary' : 'border-accented'
      ]"
    />
    <span class="flex flex-col gap-0.5">
      <span class="text-sm font-semibold text-highlighted">{{ title }}</span>
      <span
        v-if="description"
        class="text-sm text-muted"
      >{{ description }}</span>
    </span>
  </button>
</template>
