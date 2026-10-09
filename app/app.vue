<script setup lang="ts">
const head = useLocaleHead({ seo: false })

useHead({
  htmlAttrs: { lang: () => head.value.htmlAttrs.lang },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  titleTemplate: title => title ? `${title} · BibloDrive` : 'BibloDrive'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
