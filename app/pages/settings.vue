<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()
const colorMode = useColorMode()
const toast = useToast()
const api = useApi()
const session = authClient.useSession()

useHead({ title: () => t('nav.settings') })

const user = computed(() => session.value.data?.user)

// Preferences
const localeItems = computed(() => locales.value.map(item => ({ value: item.code, label: item.name ?? item.code })))
const themeItems = computed(() => (['light', 'dark', 'system'] as const).map(value => ({ value, label: t(`settings.theme.${value}`) })))

// Profile
const profile = reactive({ name: '', email: '' })
watch(user, (value) => {
  profile.name = value?.name ?? ''
  profile.email = value?.email ?? ''
}, { immediate: true })

const profileSaving = ref(false)

async function saveProfile() {
  profileSaving.value = true
  const { error } = await authClient.updateUser({ name: profile.name })
  let failed = error
  if (!error && profile.email !== user.value?.email) {
    failed = (await authClient.changeEmail({ newEmail: profile.email })).error
  }
  profileSaving.value = false
  toast.add(failed
    ? { title: failed.message ?? t('common.error'), color: 'error' }
    : { title: t('common.saved'), color: 'success' })
}

const avatarInput = ref<HTMLInputElement>()

async function uploadAvatar(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }
  const body = new FormData()
  body.append('file', file)
  if (await api(() => request('/api/profile/avatar', { method: 'POST', body }))) {
    await session.value.refetch()
  }
  avatarInput.value!.value = ''
}

// Password
const password = reactive({ current: '', next: '', confirm: '' })
const passwordSaving = ref(false)

async function changePassword() {
  if (password.next.length < 8) {
    toast.add({ title: t('validation.passwordMin'), color: 'error' })
    return
  }
  if (password.next !== password.confirm) {
    toast.add({ title: t('validation.passwordMismatch'), color: 'error' })
    return
  }
  passwordSaving.value = true
  const { error } = await authClient.changePassword({ currentPassword: password.current, newPassword: password.next, revokeOtherSessions: true })
  passwordSaving.value = false
  if (error) {
    toast.add({ title: error.message ?? t('common.error'), color: 'error' })
    return
  }
  Object.assign(password, { current: '', next: '', confirm: '' })
  toast.add({ title: t('settings.passwordChanged'), color: 'success' })
}

// Two-factor: a fresh set of backup codes replaces the old ones.
const backupOpen = ref(false)
const backupPassword = ref('')
const backupCodes = ref<string[]>([])
const backupLoading = ref(false)

function openBackupCodes() {
  backupPassword.value = ''
  backupCodes.value = []
  backupOpen.value = true
}

async function generateBackupCodes() {
  backupLoading.value = true
  const { data, error } = await authClient.twoFactor.generateBackupCodes({ password: backupPassword.value })
  backupLoading.value = false
  if (error || !data) {
    toast.add({ title: error?.message ?? t('common.error'), color: 'error' })
    return
  }
  backupCodes.value = data.backupCodes
}

async function signOut() {
  await authClient.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="settings">
      <template #header>
        <UDashboardNavbar :title="t('nav.settings')">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="flex max-w-3xl flex-col gap-5">
          <UPageCard
            :title="t('settings.preferences')"
            variant="subtle"
          >
            <div class="flex flex-col divide-y divide-default">
              <div class="flex flex-wrap items-center justify-between gap-3 pb-4">
                <div>
                  <p class="text-sm font-medium text-highlighted">
                    {{ t('settings.language') }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ t('settings.languageHint') }}
                  </p>
                </div>
                <UTabs
                  :model-value="locale"
                  :items="localeItems"
                  :content="false"
                  size="sm"
                  @update:model-value="value => setLocale(value as 'en' | 'id')"
                />
              </div>
              <div class="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div>
                  <p class="text-sm font-medium text-highlighted">
                    {{ t('settings.themeLabel') }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ t('settings.themeHint') }}
                  </p>
                </div>
                <ClientOnly>
                  <UTabs
                    v-model="colorMode.preference"
                    :items="themeItems"
                    :content="false"
                    size="sm"
                  />
                </ClientOnly>
              </div>
            </div>
          </UPageCard>

          <UPageCard
            :title="t('settings.profile')"
            variant="subtle"
          >
            <form
              class="flex flex-col gap-4"
              @submit.prevent="saveProfile"
            >
              <div class="flex items-center gap-4">
                <UAvatar
                  :src="user?.image ?? undefined"
                  :alt="user?.name"
                  size="3xl"
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  :label="t('settings.changeAvatar')"
                  @click="avatarInput?.click()"
                />
                <input
                  ref="avatarInput"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  class="hidden"
                  @change="uploadAvatar"
                >
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField :label="t('auth.name')">
                  <UInput
                    v-model="profile.name"
                    class="w-full"
                    required
                  />
                </UFormField>
                <UFormField :label="t('auth.email')">
                  <UInput
                    v-model="profile.email"
                    type="email"
                    class="w-full"
                    required
                  />
                </UFormField>
              </div>
              <UButton
                type="submit"
                class="self-start"
                :loading="profileSaving"
                :label="t('settings.saveChanges')"
              />
            </form>
          </UPageCard>

          <UPageCard
            :title="t('auth.password')"
            variant="subtle"
          >
            <form
              class="flex flex-col gap-4"
              @submit.prevent="changePassword"
            >
              <div class="grid gap-4 sm:grid-cols-3">
                <UFormField :label="t('settings.currentPassword')">
                  <UInput
                    v-model="password.current"
                    type="password"
                    autocomplete="current-password"
                    class="w-full"
                    required
                  />
                </UFormField>
                <UFormField :label="t('settings.newPassword')">
                  <UInput
                    v-model="password.next"
                    type="password"
                    autocomplete="new-password"
                    class="w-full"
                    required
                  />
                </UFormField>
                <UFormField :label="t('auth.confirmPassword')">
                  <UInput
                    v-model="password.confirm"
                    type="password"
                    autocomplete="new-password"
                    class="w-full"
                    required
                  />
                </UFormField>
              </div>
              <UButton
                type="submit"
                color="neutral"
                variant="outline"
                class="self-start"
                :loading="passwordSaving"
                :label="t('settings.updatePassword')"
              />
            </form>
          </UPageCard>

          <UPageCard
            :title="t('twoFactor.title')"
            :description="t('twoFactor.settingsHint')"
            variant="subtle"
            orientation="horizontal"
          >
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-key-square"
              class="justify-self-end"
              :label="t('twoFactor.newBackupCodes')"
              @click="openBackupCodes"
            />
          </UPageCard>

          <UPageCard
            :title="t('settings.session')"
            :description="t('settings.sessionHint')"
            variant="subtle"
            orientation="horizontal"
          >
            <UButton
              color="error"
              variant="outline"
              icon="i-lucide-log-out"
              class="justify-self-end"
              :label="t('auth.signOut')"
              @click="signOut"
            />
          </UPageCard>
        </div>
      </template>
    </UDashboardPanel>

    <UModal
      v-model:open="backupOpen"
      :title="t('twoFactor.newBackupCodes')"
    >
      <template #body>
        <BackupCodes
          v-if="backupCodes.length"
          :codes="backupCodes"
        />
        <form
          v-else
          id="backup-codes-form"
          class="flex flex-col gap-3"
          @submit.prevent="generateBackupCodes"
        >
          <p class="text-sm text-muted">
            {{ t('twoFactor.newBackupCodesHint') }}
          </p>
          <UFormField :label="t('auth.password')">
            <UInput
              v-model="backupPassword"
              type="password"
              autocomplete="current-password"
              class="w-full"
              required
              autofocus
            />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            v-if="backupCodes.length"
            :label="t('common.close')"
            @click="backupOpen = false"
          />
          <template v-else>
            <UButton
              color="neutral"
              variant="outline"
              :label="t('common.cancel')"
              @click="backupOpen = false"
            />
            <UButton
              type="submit"
              form="backup-codes-form"
              :loading="backupLoading"
              :label="t('twoFactor.generate')"
            />
          </template>
        </div>
      </template>
    </UModal>
  </div>
</template>
