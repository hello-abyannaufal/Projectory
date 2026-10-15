<script setup lang="ts">
const { t } = useI18n()
const api = useApi()
const confirm = useConfirm()
const { can } = usePermissions()

useHead({ title: () => t('nav.techStacks') })

const { data: stacks, refresh } = await useTechStacks()

const search = ref('')
const category = ref<TechCategory | 'all'>('all')

const filters = computed(() => [
  { value: 'all' as const, label: t('common.all') },
  ...TECH_CATEGORIES.map(value => ({ value, label: t(`techCategory.${value}`) }))
])

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return stacks.value.filter(stack =>
    (category.value === 'all' || stack.category === category.value)
    && (!query || stack.name.toLowerCase().includes(query))
  )
})

const formOpen = ref(false)
const catalogOpen = ref(false)
const editing = ref<TechStack>()

function openForm(stack?: TechStack) {
  editing.value = stack
  formOpen.value = true
}

async function remove(stack: TechStack) {
  if (await confirm({ title: t('techStacks.deleteTitle', { name: stack.name }) })
    && await api(() => request(`/api/tech-stacks/${stack.id}`, { method: 'DELETE' }))) {
    await refresh()
  }
}
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="tech-stacks">
      <template #header>
        <UDashboardNavbar :title="t('nav.techStacks')">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template
            v-if="can('manageTechStacks')"
            #right
          >
            <UButton
              icon="i-simple-icons-simpleicons"
              color="neutral"
              variant="outline"
              :label="t('techStacks.fromCatalog')"
              @click="catalogOpen = true"
            />
            <UButton
              icon="i-lucide-plus"
              :label="t('techStacks.newCustom')"
              @click="openForm()"
            />
          </template>
        </UDashboardNavbar>
        <UDashboardToolbar>
          <div class="flex flex-wrap items-center gap-3 py-1">
            <UInput
              v-model="search"
              icon="i-lucide-search"
              :placeholder="t('techStacks.search')"
              class="w-full sm:w-64"
            />
            <div class="flex flex-wrap gap-1.5">
              <UButton
                v-for="filter in filters"
                :key="filter.value"
                :label="filter.label"
                size="sm"
                color="neutral"
                :variant="category === filter.value ? 'solid' : 'outline'"
                class="rounded-full"
                @click="category = filter.value"
              />
            </div>
          </div>
        </UDashboardToolbar>
      </template>

      <template #body>
        <p class="mb-4 text-sm text-muted">
          {{ t('techStacks.description') }}
        </p>
        <div class="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
          <div
            v-for="stack in filtered"
            :key="stack.id"
            class="flex items-center gap-3 rounded-lg border border-default bg-default p-3"
          >
            <TechStackIcon
              :stack="stack"
              size="lg"
            />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-semibold text-highlighted">{{ stack.name }}</span>
              <span class="text-xs text-muted">
                {{ t(`techCategory.${stack.category}`) }} · {{ stack.appCount ? t('techStacks.usedIn', stack.appCount) : t('techStacks.notUsed') }}
              </span>
            </div>
            <div
              v-if="stack.isCustom"
              class="flex flex-col items-end gap-0.5"
            >
              <UBadge
                color="secondary"
                variant="subtle"
                size="sm"
                :label="t('techStacks.custom')"
              />
              <UDropdownMenu
                v-if="can('manageTechStacks')"
                :items="[[
                  { label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => openForm(stack) },
                  { label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error', disabled: stack.appCount > 0, onSelect: () => remove(stack) }
                ]]"
              >
                <UButton
                  icon="i-lucide-ellipsis"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="t('common.more')"
                />
              </UDropdownMenu>
            </div>
          </div>
        </div>
      </template>
    </UDashboardPanel>

    <TechStackFormModal
      v-model:open="formOpen"
      :stack="editing"
      @saved="refresh()"
    />
    <TechStackCatalogModal
      v-model:open="catalogOpen"
      @added="refresh()"
    />
  </div>
</template>
