// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n'
  ],

  devtools: {
    enabled: true
  },

  // Same port as the Docker app; 3000 is usually taken by other projects.
  devServer: {
    port: 4747
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // NUXT_DATABASE_URL
    databaseUrl: '',
    // NUXT_MASTER_KEY: 32-byte key (base64) used to encrypt secrets at rest
    masterKey: '',
    // NUXT_UPLOAD_DIR
    uploadDir: './data/uploads'
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  i18n: {
    // Only used for SEO link tags; override with NUXT_PUBLIC_I18N_BASE_URL
    baseUrl: 'http://localhost:4747',
    defaultLocale: 'en',
    strategy: 'no_prefix',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'id', language: 'id-ID', name: 'Bahasa Indonesia', file: 'id.json' }
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'bd_locale',
      redirectOn: 'root'
    }
  }
})
