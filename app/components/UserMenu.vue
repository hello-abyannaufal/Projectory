<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const { t } = useI18n()
const session = authClient.useSession()

const user = computed(() => session.value.data?.user)

async function signOut() {
  await authClient.signOut()
  await navigateTo('/login')
}

const items = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? '', type: 'label' }],
  [{ label: t('nav.settings'), icon: 'i-lucide-settings-2', to: '/settings' }],
  [{ label: t('auth.signOut'), icon: 'i-lucide-log-out', onSelect: signOut }]
])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      :avatar="{ src: user?.image ?? undefined, alt: user?.name }"
      :label="collapsed ? undefined : user?.name"
      trailing-icon="i-lucide-chevrons-up-down"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed' }"
    />
  </UDropdownMenu>
</template>
