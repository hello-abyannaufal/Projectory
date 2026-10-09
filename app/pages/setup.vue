<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const toast = useToast()

useHead({ title: () => t('auth.setupTitle') })

const fields = computed<AuthFormField[]>(() => [
  { name: 'name', type: 'text', label: t('auth.name'), required: true },
  { name: 'email', type: 'email', label: t('auth.email'), required: true },
  { name: 'password', type: 'password', label: t('auth.password'), required: true },
  { name: 'confirm', type: 'password', label: t('auth.confirmPassword'), required: true }
])

const schema = computed(() => z.object({
  name: z.string().min(1, t('validation.required')),
  email: z.email(t('validation.email')),
  password: z.string().min(8, t('validation.passwordMin')),
  confirm: z.string()
}).refine(data => data.password === data.confirm, {
  message: t('validation.passwordMismatch'),
  path: ['confirm']
}))

type Schema = z.output<typeof schema.value>

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<Schema>) {
  loading.value = true
  const { error } = await authClient.signUp.email({ name: data.name, email: data.email, password: data.password })
  loading.value = false
  if (error) {
    toast.add({ title: error.message ?? t('common.error'), color: 'error' })
    return
  }
  useState('setup-done').value = true
  await navigateTo('/projects')
}
</script>

<template>
  <UAuthForm
    :title="t('auth.setupTitle')"
    :description="t('auth.setupDescription')"
    icon="i-lucide-hard-drive"
    :fields="fields"
    :schema="schema"
    :loading="loading"
    :submit="{ label: t('auth.createAccount') }"
    @submit="onSubmit"
  />
</template>
