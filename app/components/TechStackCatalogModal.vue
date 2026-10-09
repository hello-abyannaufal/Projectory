<script setup lang="ts">
const emit = defineEmits<{ added: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

interface CatalogIcon { title: string, slug: string, hex: string, added: boolean }

const query = ref('')
const category = ref<TechCategory>('frontend')
const results = ref<CatalogIcon[]>([])

let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (value) => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    results.value = value.trim()
      ? await api(() => request<CatalogIcon[]>('/api/tech-stacks/catalog', { query: { q: value } })) ?? []
      : []
  }, 200)
})

watch(open, (value) => {
  if (value) {
    query.value = ''
    results.value = []
  }
})

const categoryItems = computed(() => TECH_CATEGORIES.map(value => ({ value, label: t(`techCategory.${value}`) })))

async function add(icon: CatalogIcon) {
  if (await api(() => request('/api/tech-stacks/catalog', { method: 'POST', body: { slug: icon.slug, category: category.value } }), t('techStacks.added', { name: icon.title }))) {
    icon.added = true
    emit('added')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('techStacks.fromCatalog')"
    :description="t('techStacks.fromCatalogHint')"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap gap-2">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            :placeholder="t('techStacks.searchCatalog')"
            class="min-w-0 flex-1"
            autofocus
          />
          <USelect
            v-model="category"
            :items="categoryItems"
            :aria-label="t('techStacks.category')"
            class="w-36"
          />
        </div>
        <div class="max-h-96 divide-y divide-default overflow-y-auto rounded-md border border-default">
          <div
            v-for="icon in results"
            :key="icon.slug"
            class="flex items-center gap-3 px-3 py-2"
          >
            <TechStackIcon
              :stack="{ name: icon.title, color: icon.hex, simpleIcon: icon.slug }"
              size="md"
            />
            <span class="min-w-0 flex-1 truncate text-sm">{{ icon.title }}</span>
            <UBadge
              v-if="icon.added"
              color="neutral"
              variant="soft"
              :label="t('techStacks.alreadyAdded')"
            />
            <UButton
              v-else
              icon="i-lucide-plus"
              size="sm"
              variant="soft"
              :label="t('common.add')"
              @click="add(icon)"
            />
          </div>
          <p
            v-if="!results.length"
            class="p-4 text-sm text-muted"
          >
            {{ query ? t('techStacks.noResults') : t('techStacks.typeToSearch') }}
          </p>
        </div>
      </div>
    </template>
  </UModal>
</template>
