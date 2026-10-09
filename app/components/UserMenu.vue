<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <div class="flex w-full items-center justify-between gap-2">
    <UColorModeButton />
  </div>
</template>
