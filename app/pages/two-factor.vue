<script setup lang="ts">
import { renderSVG } from 'uqr'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const toast = useToast()
const copy = useCopy()

useHead({ title: () => t('twoFactor.setupTitle') })

// password → scan → backup codes. Two-factor is on once the scanned code checks out.
const step = ref<'password' | 'scan' | 'backup'>('password')
const loading = ref(false)

const password = ref('')
const totpURI = ref('')
const backupCodes = ref<string[]>([])

const qrSrc = computed(() => totpURI.value && `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(totpURI.value, { pixelSize: 5 }))}`)
// For apps that can't scan: the same secret, typed in by hand.
const manualKey = computed(() => totpURI.value && new URL(totpURI.value).searchParams.get('secret'))

async function start() {
  loading.value = true
  const { data, error } = await authClient.twoFactor.enable({ password: password.value })
  loading.value = false
  if (error || !data || !('totpURI' in data) || !data.totpURI) {
    toast.add({ title: error?.message ?? t('common.error'), color: 'error' })
    return
  }
  totpURI.value = data.totpURI
  backupCodes.value = data.backupCodes ?? []
  password.value = ''
  step.value = 'scan'
}

const pin = ref<string[]>([])

async function confirmCode() {
  const code = pin.value.join('')
  if (code.length < 6 || loading.value) {
    return
  }
  loading.value = true
  const { error } = await authClient.twoFactor.verifyTotp({ code })
  loading.value = false
  if (error) {
    pin.value = []
    toast.add({ title: t('twoFactor.invalidCode'), color: 'error' })
    return
  }
  step.value = 'backup'
}

async function signOut() {
  await authClient.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-col items-center gap-2 text-center">
      <UIcon
        name="i-lucide-shield-check"
        class="size-8 text-highlighted"
      />
      <p class="text-xl font-semibold text-highlighted">
        {{ t('twoFactor.setupTitle') }}
      </p>
      <p class="text-sm text-muted">
        {{ t(`twoFactor.setupStep.${step}`) }}
      </p>
    </div>

    <form
      v-if="step === 'password'"
      class="flex flex-col gap-4"
      @submit.prevent="start"
    >
      <UFormField :label="t('auth.password')">
        <UInput
          v-model="password"
          type="password"
          autocomplete="current-password"
          class="w-full"
          required
          autofocus
        />
      </UFormField>
      <UButton
        type="submit"
        block
        :loading="loading"
        :label="t('twoFactor.continue')"
      />
    </form>

    <form
      v-else-if="step === 'scan'"
      class="flex flex-col items-center gap-4"
      @submit.prevent="confirmCode"
    >
      <img
        :src="qrSrc"
        :alt="t('twoFactor.qrAlt')"
        class="size-48 rounded-md bg-white p-2"
      >
      <div class="w-full text-center">
        <p class="text-xs text-muted">
          {{ t('twoFactor.manualKey') }}
        </p>
        <div class="flex items-center justify-center gap-1">
          <code class="text-sm break-all text-highlighted">{{ manualKey }}</code>
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-copy"
            :aria-label="t('common.copy')"
            @click="copy(manualKey ?? '')"
          />
        </div>
      </div>
      <UPinInput
        v-model="pin"
        :length="6"
        otp
        autofocus
        @complete="confirmCode"
      />
      <UButton
        type="submit"
        block
        :loading="loading"
        :label="t('twoFactor.verify')"
      />
    </form>

    <div
      v-else
      class="flex flex-col gap-4"
    >
      <BackupCodes :codes="backupCodes" />
      <UButton
        block
        :label="t('twoFactor.savedContinue')"
        @click="navigateTo('/projects')"
      />
    </div>

    <UButton
      v-if="step !== 'backup'"
      variant="link"
      color="neutral"
      class="self-center"
      :label="t('auth.signOut')"
      @click="signOut"
    />
  </div>
</template>
