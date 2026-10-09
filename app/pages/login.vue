<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const toast = useToast()

useHead({ title: () => t('auth.signIn') })

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

async function onSubmit({ data }: FormSubmitEvent<Schema>) {
  loading.value = true
  const { error } = await authClient.signIn.email(data)
  loading.value = false
  if (error) {
    toast.add({ title: t('auth.invalidCredentials'), color: 'error' })
    return
  }
  await navigateTo('/projects')
}
</script>

<template>
  <UAuthForm
    :title="t('auth.signIn')"
    description="BibloDrive"
    icon="i-lucide-lock"
    :fields="fields"
    :schema="schema"
    :loading="loading"
    :submit="{ label: t('auth.signIn') }"
    @submit="onSubmit"
  />
</template>
