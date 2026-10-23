<script setup lang="ts">
definePageMeta({ permission: 'manageUsers' })

const { t, locale } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const session = authClient.useSession()
const api = useApi()
const { role: myRole } = usePermissions()

useHead({ title: () => t('nav.users') })

const currentUserId = computed(() => session.value.data?.user.id)

interface User {
  id: string
  name: string
  email: string
  image?: string | null
  role?: string
  twoFactorEnabled?: boolean | null
  createdAt: string
}

// useFetch rather than authClient so the list also loads during SSR.
const { data, refresh } = await useFetch<{ users: User[] }>('/api/auth/admin/list-users', {
  query: { limit: 500, sortBy: 'createdAt', sortDirection: 'asc' }
})
const users = computed(() => data.value?.users ?? [])

const roleItems = computed(() => ROLES.map(value => ({ value, label: t(`roles.${value}`), description: t(`roleDescription.${value}`) })))
// The roles you may hand out: a super user can't make super users, nobody can make a master.
const assignableRoles = computed(() => roleItems.value.filter(item => canManageRole(myRole.value, item.value)))

// The master card is only shown to the master.
const legendRoles = computed(() => roleItems.value.filter(item => item.value !== 'master' || myRole.value === 'master'))

// Your own account and roles above yours are shown but can't be changed here.
function canManage(user: User) {
  return user.id !== currentUserId.value && canManageRole(myRole.value, user.role)
}

// Runs a Better Auth call and reports its error, if any. Returns true on success.
async function run(call: Promise<{ error: { message?: string } | null }>, success?: string) {
  const { error } = await call
  if (error) {
    toast.add({ title: error.message ?? t('common.error'), color: 'error' })
    return false
  }
  if (success) {
    toast.add({ title: success, color: 'success' })
  }
  return true
}

async function setRole(user: User, role: Role) {
  if (await run(authClient.admin.setRole({ userId: user.id, role }), t('common.saved'))) {
    await refresh()
  }
}

async function removeUser(user: User) {
  if (await confirm({ title: t('users.deleteTitle', { name: user.name }), description: t('users.deleteDescription') })
    && await run(authClient.admin.removeUser({ userId: user.id }))) {
    await refresh()
  }
}

// The user sets two-factor up again at their next sign-in.
async function resetTwoFactor(user: User) {
  if (await confirm({ title: t('users.resetTwoFactorTitle', { name: user.name }), description: t('users.resetTwoFactorDescription') })
    && await api(() => request(`/api/users/${user.id}/two-factor`, { method: 'DELETE' }), t('users.twoFactorReset'))) {
    await refresh()
  }
}

// Add user
const createOpen = ref(false)
const createState = reactive({ name: '', email: '', password: '', role: 'viewer' as Role })
const creating = ref(false)

function openCreate() {
  Object.assign(createState, { name: '', email: '', password: '', role: 'viewer' })
  createOpen.value = true
}

async function createUser() {
  if (createState.password.length < 8) {
    toast.add({ title: t('validation.passwordMin'), color: 'error' })
    return
  }
  creating.value = true
  const ok = await run(authClient.admin.createUser({ ...createState }), t('users.created'))
  creating.value = false
  if (ok) {
    createOpen.value = false
    await refresh()
  }
}

// Reset password
const resetOpen = ref(false)
const resetUser = ref<User>()
const newPassword = ref('')
const resetting = ref(false)

function openReset(user: User) {
  resetUser.value = user
  newPassword.value = ''
  resetOpen.value = true
}

async function resetPassword() {
  if (!resetUser.value) {
    return
  }
  if (newPassword.value.length < 8) {
    toast.add({ title: t('validation.passwordMin'), color: 'error' })
    return
  }
  resetting.value = true
  const ok = await run(authClient.admin.setUserPassword({ userId: resetUser.value.id, newPassword: newPassword.value }), t('settings.passwordChanged'))
  resetting.value = false
  if (ok) {
    resetOpen.value = false
  }
}
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="users">
      <template #header>
        <UDashboardNavbar :title="t('nav.users')">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <UButton
              icon="i-lucide-user-plus"
              :label="t('users.new')"
              @click="openCreate"
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="flex max-w-4xl flex-col gap-3">
          <div
            v-for="user in users"
            :key="user.id"
            class="flex flex-wrap items-center gap-4 rounded-lg border border-default bg-default p-4"
          >
            <UAvatar
              :src="user.image ?? undefined"
              :alt="user.name"
            />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="font-semibold text-highlighted">
                {{ user.name }}
                <span
                  v-if="user.id === currentUserId"
                  class="font-normal text-muted"
                >({{ t('users.you') }})</span>
              </span>
              <span class="truncate text-sm text-muted">{{ user.email }}</span>
              <UBadge
                v-if="!user.twoFactorEnabled"
                color="warning"
                variant="subtle"
                size="sm"
                class="mt-1 self-start"
                :label="t('users.twoFactorPending')"
              />
              <span class="text-xs text-dimmed">{{ t('users.joined', { time: timeAgo(user.createdAt, locale) }) }}</span>
            </div>
            <USelect
              v-if="canManage(user)"
              :model-value="user.role as Role"
              :items="assignableRoles"
              class="w-40"
              @update:model-value="value => setRole(user, value as Role)"
            />
            <span
              v-else
              class="w-40 px-2.5 text-sm text-muted"
            >{{ t(`roles.${user.role}`) }}</span>
            <UDropdownMenu
              v-if="canManage(user)"
              :items="[[
                { label: t('users.resetPassword'), icon: 'i-lucide-key-round', onSelect: () => openReset(user) },
                { label: t('users.resetTwoFactor'), icon: 'i-lucide-smartphone', disabled: !user.twoFactorEnabled, onSelect: () => resetTwoFactor(user) }
              ], [
                { label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => removeUser(user) }
              ]]"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                :aria-label="t('common.more')"
              />
            </UDropdownMenu>
          </div>

          <div
            class="mt-2 grid gap-3"
            :class="legendRoles.length > 3 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'"
          >
            <div
              v-for="role in legendRoles"
              :key="role.value"
              class="rounded-lg border border-default p-3"
            >
              <p class="text-sm font-semibold text-highlighted">
                {{ role.label }}
              </p>
              <p class="text-xs text-muted">
                {{ role.description }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </UDashboardPanel>

    <UModal
      v-model:open="createOpen"
      :title="t('users.new')"
    >
      <template #body>
        <form
          id="user-form"
          class="flex flex-col gap-4"
          @submit.prevent="createUser"
        >
          <UFormField
            :label="t('auth.name')"
            required
          >
            <UInput
              v-model="createState.name"
              class="w-full"
              required
              autofocus
            />
          </UFormField>
          <UFormField
            :label="t('auth.email')"
            required
          >
            <UInput
              v-model="createState.email"
              type="email"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField
            :label="t('users.initialPassword')"
            :description="t('users.initialPasswordHint')"
            required
          >
            <UInput
              v-model="createState.password"
              type="password"
              autocomplete="new-password"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField :label="t('users.role')">
            <USelect
              v-model="createState.role"
              :items="assignableRoles"
              class="w-full"
            />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            :label="t('common.cancel')"
            @click="createOpen = false"
          />
          <UButton
            type="submit"
            form="user-form"
            :loading="creating"
            :label="t('users.new')"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="resetOpen"
      :title="t('users.resetPassword')"
      :description="resetUser?.email"
    >
      <template #body>
        <form
          id="reset-form"
          @submit.prevent="resetPassword"
        >
          <UFormField :label="t('settings.newPassword')">
            <UInput
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              class="w-full"
              autofocus
            />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            :label="t('common.cancel')"
            @click="resetOpen = false"
          />
          <UButton
            type="submit"
            form="reset-form"
            :loading="resetting"
            :label="t('common.save')"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
