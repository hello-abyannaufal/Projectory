<script setup lang="ts">
const props = defineProps<{
  group?: Group
}>()

// The VPN count shown on the group header changed.
const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const { can } = usePermissions()
const api = useApi()
const confirm = useConfirm()
const copy = useCopy()

interface GroupVpn {
  id: string
  name: string
  host: string
  notes: string | null
  account: { username: string, hasPassword: boolean, notes: string | null } | null
}

const vpns = ref<GroupVpn[]>([])
const loading = ref(false)
// Passwords fetched on request, by VPN id
const shown = ref<Record<string, string>>({})

async function load() {
  if (!props.group) {
    return
  }
  loading.value = true
  vpns.value = await api(() => request<GroupVpn[]>('/api/group-vpns', { query: { groupId: props.group!.id } })) ?? []
  loading.value = false
}

watch(open, (value) => {
  if (value) {
    vpns.value = []
    shown.value = {}
    load()
  }
})

async function fetchPassword(vpn: GroupVpn) {
  const result = await api(() => request<{ password: string }>(`/api/group-vpns/${vpn.id}/account/password`))
  return result?.password
}

async function togglePassword(vpn: GroupVpn) {
  if (vpn.id in shown.value) {
    shown.value = Object.fromEntries(Object.entries(shown.value).filter(([id]) => id !== vpn.id))
    return
  }
  const password = await fetchPassword(vpn)
  if (password !== undefined) {
    shown.value[vpn.id] = password
  }
}

async function copyPassword(vpn: GroupVpn) {
  const password = vpn.id in shown.value ? shown.value[vpn.id] : await fetchPassword(vpn)
  if (password !== undefined) {
    await copy(password)
  }
}

const formOpen = ref(false)
const editing = ref<GroupVpn>()

function openForm(vpn?: GroupVpn) {
  editing.value = vpn
  formOpen.value = true
}

const accountOpen = ref(false)
const accountVpn = ref<GroupVpn>()

function openAccount(vpn: GroupVpn) {
  accountVpn.value = vpn
  accountOpen.value = true
}

async function onSaved() {
  shown.value = {}
  await load()
  emit('changed')
}

async function remove(vpn: GroupVpn) {
  if (await confirm({ title: t('infra.deleteTitle', { name: vpn.name }), description: t('groupVpn.deleteDescription') })
    && await api(() => request(`/api/group-vpns/${vpn.id}`, { method: 'DELETE' }))) {
    await onSaved()
  }
}

async function removeAccount(vpn: GroupVpn) {
  if (await confirm({ title: t('groupVpn.deleteAccountTitle', { name: vpn.name }) })
    && await api(() => request(`/api/group-vpns/${vpn.id}/account`, { method: 'DELETE' }))) {
    await onSaved()
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('groupVpn.title', { name: group?.name ?? '' })"
    :description="t('groupVpn.description')"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <div
          v-if="loading"
          class="flex justify-center py-6"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-5 animate-spin text-muted"
          />
        </div>
        <p
          v-else-if="!vpns.length"
          class="text-sm text-muted"
        >
          {{ can('manageVpns') ? t('groupVpn.emptyManage') : t('groupVpn.empty') }}
        </p>
        <div
          v-for="vpn in vpns"
          v-else
          :key="vpn.id"
          class="flex flex-col gap-2"
        >
          <InfraItemRow
            :item="{ ...vpn, type: 'vpn' }"
            :editable="can('manageVpns')"
            @edit="openForm(vpn)"
            @delete="remove(vpn)"
          />
          <div class="ml-7 flex items-center gap-2 rounded-lg bg-elevated/50 px-3 py-2 text-sm">
            <UIcon
              name="i-lucide-user-round"
              class="size-4 shrink-0 text-muted"
            />
            <template v-if="vpn.account">
              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <div class="flex min-w-0 items-center gap-1">
                  <code class="truncate font-mono">{{ vpn.account.username }}</code>
                  <UButton
                    icon="i-lucide-copy"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :aria-label="t('common.copy')"
                    @click="copy(vpn.account.username)"
                  />
                </div>
                <div
                  v-if="vpn.account.hasPassword"
                  class="flex min-w-0 items-center gap-1"
                >
                  <code class="truncate font-mono">{{ vpn.id in shown ? shown[vpn.id] : '••••••••' }}</code>
                  <UButton
                    :icon="vpn.id in shown ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :aria-label="vpn.id in shown ? t('groupVpn.hidePassword') : t('groupVpn.showPassword')"
                    @click="togglePassword(vpn)"
                  />
                  <UButton
                    icon="i-lucide-copy"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :aria-label="t('groupVpn.copyPassword')"
                    @click="copyPassword(vpn)"
                  />
                </div>
                <p
                  v-if="vpn.account.notes"
                  class="text-xs whitespace-pre-line text-muted"
                >
                  {{ vpn.account.notes }}
                </p>
              </div>
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="t('common.edit')"
                @click="openAccount(vpn)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :aria-label="t('common.delete')"
                @click="removeAccount(vpn)"
              />
            </template>
            <template v-else>
              <span class="flex-1 text-muted">{{ t('groupVpn.noAccount') }}</span>
              <UButton
                icon="i-lucide-plus"
                color="neutral"
                variant="outline"
                size="xs"
                :label="t('groupVpn.addAccount')"
                @click="openAccount(vpn)"
              />
            </template>
          </div>
        </div>
        <UButton
          v-if="can('manageVpns')"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          class="self-start"
          :label="t('groupVpn.new')"
          @click="openForm()"
        />
      </div>
    </template>
  </UModal>
  <GroupVpnFormModal
    v-model:open="formOpen"
    :group-id="group?.id"
    :vpn="editing"
    @saved="onSaved"
  />
  <GroupVpnAccountFormModal
    v-model:open="accountOpen"
    :vpn="accountVpn"
    @saved="onSaved"
  />
</template>
