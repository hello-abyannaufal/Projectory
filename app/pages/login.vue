<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const toast = useToast()

useHead({ title: () => t('auth.signIn') })

const route = useRoute()

onMounted(() => {
  if (route.query.idle) {
    toast.add({ title: t('auth.signedOutIdle'), icon: 'i-lucide-timer-off', color: 'warning' })
  }
})

const fields = computed<AuthFormField[]>(() => [
  { name: 'email', type: 'email', label: t('auth.email'), required: true },
  { name: 'password', type: 'password', label: t('auth.password'), required: true }
])

const schema = computed(() => z.object({
  email: z.email(t('validation.email')),
  password: z.string().min(1, t('validation.required'))
}))

type Schema = z.output<typeof schema.value>

const loading = ref(false)
// Set once the password is accepted and the account still needs its code.
const needsCode = ref(false)

async function onSubmit({ data }: FormSubmitEvent<Schema>) {
  loading.value = true
  const { data: result, error } = await authClient.signIn.email(data)
  loading.value = false
  if (error) {
    toast.add({ title: t('auth.invalidCredentials'), color: 'error' })
    return
  }
  if (result && 'twoFactorRedirect' in result && result.twoFactorRedirect) {
    needsCode.value = true
    return
  }
  await navigateTo('/projects')
}

// Second step: a code from the authenticator app, or a backup code.
const useBackupCode = ref(false)
const pin = ref<string[]>([])
const backupCode = ref('')
const trustDevice = ref(true)

// The challenge is gone after too many wrong codes or ten minutes: start over.
const RESTART_CODES = ['TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE', 'INVALID_TWO_FACTOR_COOKIE']

async function verifyCode() {
  const code = useBackupCode.value ? backupCode.value.trim() : pin.value.join('')
  if (!code || loading.value) {
    return
  }
  loading.value = true
  const { error } = useBackupCode.value
    ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: trustDevice.value })
    : await authClient.twoFactor.verifyTotp({ code, trustDevice: trustDevice.value })
  loading.value = false
  if (!error) {
    await navigateTo('/projects')
    return
  }
  pin.value = []
  if (error.code && RESTART_CODES.includes(error.code)) {
    needsCode.value = false
    toast.add({ title: t('twoFactor.signInAgain'), color: 'error' })
    return
  }
  toast.add({
    title: error.code === 'ACCOUNT_TEMPORARILY_LOCKED' ? t('twoFactor.locked') : t('twoFactor.invalidCode'),
    color: 'error'
  })
}
</script>

<template>
  <UAuthForm
    v-if="!needsCode"
    :title="t('auth.signIn')"
    description="Projectory"
    icon="i-lucide-lock"
    :fields="fields"
    :schema="schema"
    :loading="loading"
    :submit="{ label: t('auth.signIn') }"
    @submit="onSubmit"
  />

  <form
    v-else
    class="flex flex-col items-center gap-5 text-center"
    @submit.prevent="verifyCode"
  >
    <UIcon
      name="i-lucide-smartphone"
      class="size-8 text-highlighted"
    />
    <div>
      <p class="text-xl font-semibold text-highlighted">
        {{ t('twoFactor.title') }}
      </p>
      <p class="mt-1 text-sm text-muted">
        {{ useBackupCode ? t('twoFactor.backupCodeHint') : t('twoFactor.codeHint') }}
      </p>
    </div>

    <UInput
      v-if="useBackupCode"
      v-model="backupCode"
      autocomplete="off"
      placeholder="xxxxx-xxxxx"
      class="w-full"
      autofocus
    />
    <UPinInput
      v-else
      v-model="pin"
      :length="6"
      otp
      autofocus
      @complete="verifyCode"
    />

    <UCheckbox
      v-model="trustDevice"
      :label="t('twoFactor.trustDevice', { days: TWO_FACTOR_TRUST_DAYS })"
      class="self-start"
    />

    <UButton
      type="submit"
      block
      :loading="loading"
      :label="t('twoFactor.verify')"
    />
    <UButton
      variant="link"
      color="neutral"
      :label="useBackupCode ? t('twoFactor.useApp') : t('twoFactor.useBackupCode')"
      @click="useBackupCode = !useBackupCode"
    />
  </form>
</template>
