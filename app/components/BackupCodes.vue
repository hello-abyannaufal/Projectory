<script setup lang="ts">
const props = defineProps<{
  codes: string[]
}>()

const { t } = useI18n()
const copy = useCopy()

function download() {
  const blob = new Blob([`Projectory backup codes\n\n${props.codes.join('\n')}\n`], { type: 'text/plain' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'projectory-backup-codes.txt'
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-sm text-muted">
      {{ t('twoFactor.backupCodesHint') }}
    </p>
    <div class="grid grid-cols-2 gap-2 rounded-md border border-default p-3 font-mono text-sm">
      <span
        v-for="code in codes"
        :key="code"
        class="text-center"
      >{{ code }}</span>
    </div>
    <div class="flex gap-2">
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-copy"
        class="flex-1 justify-center"
        :label="t('common.copy')"
        @click="copy(codes.join('\n'))"
      />
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-download"
        class="flex-1 justify-center"
        :label="t('twoFactor.download')"
        @click="download"
      />
    </div>
  </div>
</template>
