<script setup lang="ts">
const head = useLocaleHead({ seo: false })
const { public: { appVersion } } = useRuntimeConfig()

useHead({
  htmlAttrs: { lang: () => head.value.htmlAttrs.lang },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  titleTemplate: title => title ? `${title} · Projectory` : 'Projectory'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <span class="pointer-events-none fixed right-3 bottom-2 z-10 text-xs text-muted select-none">v{{ appVersion }}</span>
  </UApp>
</template>
