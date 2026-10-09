<script setup lang="ts">
const props = withDefaults(defineProps<{
  stack: { name: string, color: string, simpleIcon?: string | null, logo?: string | null }
  size?: 'sm' | 'md' | 'lg'
}>(), {
  size: 'sm'
})

const box = computed(() => ({
  sm: 'size-4 text-[8px]',
  md: 'size-8 text-[11px] rounded-md',
  lg: 'size-10 text-xs rounded-lg'
}[props.size]))
</script>

<template>
  <img
    v-if="stack.logo"
    :src="uploadUrl(stack.logo)"
    :alt="stack.name"
    :class="['shrink-0 object-contain', box]"
  >
  <UIcon
    v-else-if="stack.simpleIcon"
    :name="`i-simple-icons-${stack.simpleIcon}`"
    :class="['shrink-0', box]"
    :style="{ color: `#${stack.color}` }"
  />
  <span
    v-else
    :class="['flex shrink-0 items-center justify-center rounded font-bold text-white', box]"
    :style="{ backgroundColor: `#${stack.color}` }"
  >{{ initials(stack.name) }}</span>
</template>
