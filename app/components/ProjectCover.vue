<script setup lang="ts">
withDefaults(defineProps<{
  name: string
  cover?: string | null
  size?: 'md' | 'lg'
}>(), {
  size: 'md'
})
</script>

<template>
  <img
    v-if="cover"
    :src="uploadUrl(cover)"
    :alt="name"
    :class="['shrink-0 rounded-lg object-cover', size === 'lg' ? 'size-16' : 'size-11']"
  >
  <span
    v-else
    :class="[
      'flex shrink-0 items-center justify-center rounded-lg bg-inverted font-bold text-inverted',
      size === 'lg' ? 'size-16 text-xl' : 'size-11 text-sm'
    ]"
  >{{ initials(name) }}</span>
</template>
