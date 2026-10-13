<script setup lang="ts">
const route = useRoute()
const { t, locale } = useI18n()
const api = useApi()
const confirm = useConfirm()
const copy = useCopy()
const toast = useToast()
const { can } = usePermissions()

const deploymentId = computed(() => route.params.deploymentId as string)
const { data: deployment, refresh, error } = await useDeployment(deploymentId)

if (error.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Deployment not found', fatal: true })
}
if (error.value?.statusCode === 403) {
  throw createError({ statusCode: 403, statusMessage: 'This group is locked. Enter its access code on the Projects page.', fatal: true })
}

useHead({ title: () => deployment.value ? `${deployment.value.app.name} · ${deployment.value.environment.name}` : '' })

const isProduction = computed(() => deployment.value?.environment.isProduction ?? false)
const projectPath = computed(() => `/projects/${deployment.value?.project.id}`)

// Secrets are fetched per account on demand and cached until the next refresh.
const secretCache = new Map<string, Record<string, string>>()

function loadSecrets(accountId: string) {
  return async () => {
    if (!secretCache.has(accountId)) {
      const secrets = await api(() => request<Record<string, string>>(`/api/accounts/${accountId}/reveal`))
      if (!secrets) {
        return undefined
      }
      secretCache.set(accountId, secrets)
    }
    return secretCache.get(accountId)
  }
}

async function reload() {
  secretCache.clear()
  await refresh()
}

// Deployment
const editOpen = ref(false)

async function deleteDeployment() {
  if (await confirm({ title: t('deployments.deleteTitle'), description: t('deployments.deleteDescription') })
    && await api(() => request(`/api/deployments/${deploymentId.value}`, { method: 'DELETE' }))) {
    await navigateTo(projectPath.value)
  }
}

// Accounts
const accountOpen = ref(false)
const editingAccount = ref<DeploymentAccount>()

function openAccount(account?: DeploymentAccount) {
  editingAccount.value = account
  accountOpen.value = true
}

async function deleteAccount(account: DeploymentAccount) {
  if (await confirm({ title: t('accounts.deleteTitle', { name: account.label }) })
    && await api(() => request(`/api/accounts/${account.id}`, { method: 'DELETE' }))) {
    await reload()
  }
}

const accountSort = useDragSort(() => deployment.value?.testAccounts ?? [], async () => {
  const ids = deployment.value?.testAccounts.map(account => account.id) ?? []
  await api(() => request(`/api/deployments/${deploymentId.value}/accounts/reorder`, { method: 'POST', body: { ids } }))
  await refresh()
})

async function setAccountStatus(account: DeploymentAccount, status: TestAccountStatus) {
  if (await api(() => request(`/api/accounts/${account.id}`, { method: 'PATCH', body: { status } }))) {
    await reload()
  }
}

// Locked, expired or not verified recently.
const accountFilter = ref<'all' | 'attention'>('all')
const attentionCount = computed(() => deployment.value?.testAccounts.filter(account => accountAttention(account)).length ?? 0)

watch(attentionCount, (count) => {
  if (!count) {
    accountFilter.value = 'all'
  }
})

function accountVisible(account: DeploymentAccount) {
  return accountFilter.value === 'all' || !!accountAttention(account)
}

async function verifyAccount(account: DeploymentAccount) {
  if (await api(() => request(`/api/accounts/${account.id}`, { method: 'PATCH', body: { lastVerifiedAt: new Date().toISOString() } }))) {
    await reload()
  }
}

// Releases
const releaseOpen = ref(false)
const editingRelease = ref<DeploymentRelease>()

function openRelease(release?: DeploymentRelease) {
  editingRelease.value = release
  releaseOpen.value = true
}

async function deleteRelease(release: DeploymentRelease) {
  if (await confirm({ title: t('releases.deleteTitle', { version: release.version }) })
    && await api(() => request(`/api/releases/${release.id}`, { method: 'DELETE' }))) {
    await refresh()
  }
}

// Notes
const notes = ref<Record<string, unknown> | null>(null)
const notesSaving = ref(false)

watch(() => deployment.value?.notes, (value) => {
  notes.value = asDoc(value)
}, { immediate: true })

async function saveNotes() {
  notesSaving.value = true
  const saved = await api(() => request(`/api/deployments/${deploymentId.value}`, { method: 'PATCH', body: { notes: notes.value } }))
  notesSaving.value = false
  if (saved) {
    toast.add({ title: t('common.saved'), color: 'success' })
  }
}

// Copy as text
async function copyAsText(withSecrets: boolean) {
  const value = deployment.value
  if (!value) {
    return
  }
  const lines = [`${value.app.name} — ${value.environment.name}`]
  if (value.url) {
    lines.push(`URL: ${value.url}`)
  }
  if (value.branch) {
    lines.push(`Branch: ${value.branch}`)
  }
  for (const account of value.testAccounts) {
    const secrets = withSecrets ? await loadSecrets(account.id)() : undefined
    if (withSecrets && !secrets) {
      return
    }
    lines.push('', `Account: ${account.label}${account.tags.length ? ` (${account.tags.join(', ')})` : ''}`)
    for (const field of account.fields) {
      const fieldValue = field.isSecret ? (secrets?.[field.id] ?? SECRET_MASK) : field.value
      lines.push(`  ${field.key}: ${fieldValue}`)
    }
  }
  await copy(lines.join('\n'))
}

const copyItems = computed(() => [[
  { label: t('deployments.copyWithoutSecrets'), icon: 'i-lucide-shield', onSelect: () => copyAsText(false) },
  ...(isProduction.value || !can('viewSecrets') ? [] : [{ label: t('deployments.copyWithSecrets'), icon: 'i-lucide-shield-alert', onSelect: () => copyAsText(true) }])
]])
</script>

<template>
  <div class="contents">
    <UDashboardPanel
      v-if="deployment"
      id="deployment"
    >
      <template #header>
        <UDashboardNavbar>
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #title>
            <UBreadcrumb
              :items="[
                { label: t('nav.projects'), to: '/projects' },
                { label: deployment.project.group.name, to: '/projects' },
                { label: deployment.project.name, to: projectPath },
                { label: deployment.app.name },
                { label: deployment.environment.name }
              ]"
            />
          </template>
          <template #right>
            <UDropdownMenu :items="copyItems">
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="outline"
                :label="t('deployments.copyAsText')"
              />
            </UDropdownMenu>
            <UButton
              v-if="deployment.url"
              icon="i-lucide-external-link"
              :label="t('deployments.openApp')"
              :to="deployment.url"
              target="_blank"
              rel="noopener noreferrer"
            />
            <UDropdownMenu
              v-if="can('edit')"
              :items="[[
                { label: t('deployments.edit'), icon: 'i-lucide-pencil', onSelect: () => { editOpen = true } },
                { label: t('deployments.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: deleteDeployment }
              ]]"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                :aria-label="t('common.more')"
              />
            </UDropdownMenu>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="flex flex-col gap-6">
          <div class="flex flex-col gap-3">
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="text-2xl font-bold text-highlighted">
                {{ deployment.app.name }}
              </h1>
              <nav
                :aria-label="t('environments.title')"
                class="flex gap-0.5 rounded-lg bg-elevated p-0.5"
              >
                <NuxtLink
                  v-for="sibling in deployment.siblings"
                  :key="sibling.id"
                  :to="`${projectPath}/deployments/${sibling.id}`"
                  :aria-current="sibling.id === deployment.id ? 'page' : undefined"
                  :class="[
                    'flex items-center gap-1 rounded-md px-3 py-1.5 text-sm',
                    sibling.id === deployment.id ? 'bg-default font-semibold text-highlighted shadow-xs' : 'text-muted hover:text-default'
                  ]"
                >
                  {{ sibling.name }}
                  <UIcon
                    v-if="sibling.isProduction"
                    name="i-lucide-lock"
                    class="size-3"
                  />
                </NuxtLink>
              </nav>
            </div>
            <div class="flex flex-wrap items-center gap-4 text-sm">
              <span
                v-if="deployment.url"
                class="inline-flex items-center gap-1"
              >
                <a
                  :href="deployment.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono text-primary hover:underline"
                >{{ deployment.url }}</a>
                <UButton
                  icon="i-lucide-copy"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :aria-label="t('common.copy')"
                  @click="copy(deployment.url)"
                />
              </span>
              <UButton
                v-else-if="can('edit')"
                icon="i-lucide-plus"
                variant="ghost"
                size="sm"
                :label="t('deployments.addUrl')"
                @click="editOpen = true"
              />
              <span
                v-if="deployment.branch"
                class="inline-flex items-center gap-1.5 text-muted"
              >
                <UIcon
                  name="i-lucide-git-branch"
                  class="size-4"
                />
                <code class="font-mono">{{ deployment.branch }}</code>
              </span>
              <UButton
                v-if="deployment.url && can('edit')"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="t('deployments.edit')"
                @click="editOpen = true"
              />
            </div>
          </div>

          <div class="flex flex-wrap items-start gap-5">
            <div class="flex min-w-0 flex-[999_1_36rem] flex-col gap-5">
              <UAlert
                v-if="isProduction"
                color="warning"
                variant="subtle"
                icon="i-lucide-lock"
                :title="t('deployments.productionTitle')"
                :description="t('deployments.productionDescription')"
              />

              <section
                v-else
                class="flex flex-col gap-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <h2 class="font-semibold text-highlighted">
                    {{ t('accounts.title') }}
                    <span class="font-normal text-muted">· {{ deployment.testAccounts.length }}</span>
                  </h2>
                  <UTabs
                    v-if="attentionCount"
                    v-model="accountFilter"
                    :items="[
                      { label: t('common.all'), value: 'all' },
                      { label: t('accounts.attentionCount', attentionCount), value: 'attention', icon: 'i-lucide-triangle-alert' }
                    ]"
                    :content="false"
                    size="xs"
                    class="mr-auto"
                  />
                  <UButton
                    v-if="can('edit')"
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    :label="t('accounts.new')"
                    @click="openAccount()"
                  />
                </div>
                <div
                  v-if="deployment.testAccounts.length"
                  class="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(19rem,1fr))]"
                >
                  <AccountCard
                    v-for="(account, index) in deployment.testAccounts"
                    v-show="accountVisible(account)"
                    :key="account.id"
                    v-bind="accountSort.item(index)"
                    :account="account"
                    :drag-handle="can('edit') && accountFilter === 'all' ? accountSort.handle(index) : undefined"
                    :editable="can('edit')"
                    :can-reveal="can('viewSecrets')"
                    :class="accountSort.dragging.value === index && 'opacity-50'"
                    :load-secrets="loadSecrets(account.id)"
                    @edit="openAccount(account)"
                    @delete="deleteAccount(account)"
                    @verify="verifyAccount(account)"
                    @status="status => setAccountStatus(account, status)"
                  />
                </div>
                <p
                  v-else
                  class="rounded-lg border border-dashed border-accented p-6 text-center text-sm text-muted"
                >
                  {{ t('accounts.empty') }}
                </p>
              </section>

              <EnvSection
                v-if="!isProduction"
                :deployment-id="deployment.id"
                :env-vars="deployment.envVars"
                :editable="can('edit')"
                :can-reveal="can('viewSecrets')"
                :environment-name="deployment.environment.name"
                :siblings="deployment.siblings"
                title=".env"
                @changed="refresh()"
              />
            </div>

            <aside class="flex min-w-0 flex-[1_1_20rem] flex-col gap-5">
              <section class="flex flex-col gap-1 rounded-lg border border-default bg-default p-4">
                <div class="mb-2 flex items-center justify-between">
                  <h2 class="font-semibold text-highlighted">
                    {{ t('releases.title') }}
                  </h2>
                  <UButton
                    v-if="can('edit')"
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    :aria-label="t('releases.new')"
                    @click="openRelease()"
                  />
                </div>
                <div
                  v-for="release in deployment.releases"
                  :key="release.id"
                  class="group flex flex-col gap-1 border-t border-default py-3"
                >
                  <div class="flex items-center justify-between gap-2">
                    <a
                      v-if="release.url"
                      :href="release.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="font-mono font-medium text-highlighted hover:text-primary"
                    >{{ release.version }}</a>
                    <span
                      v-else
                      class="font-mono font-medium text-highlighted"
                    >{{ release.version }}</span>
                    <div class="flex items-center gap-1">
                      <UBadge
                        :color="releaseStatusColor[release.status]"
                        variant="subtle"
                        size="sm"
                        :label="t(`releaseStatus.${release.status}`)"
                      />
                      <UDropdownMenu
                        v-if="can('edit')"
                        :items="[[
                          { label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => openRelease(release) },
                          { label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => deleteRelease(release) }
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
                  <span class="text-xs text-muted">
                    {{ [release.buildNumber && `Build ${release.buildNumber}`, t(`releaseType.${release.type}`), release.releasedAt && new Date(release.releasedAt).toLocaleDateString(locale, { dateStyle: 'medium' })].filter(Boolean).join(' · ') }}
                  </span>
                  <p
                    v-if="release.changelog"
                    class="text-sm whitespace-pre-line text-toned"
                  >
                    {{ release.changelog }}
                  </p>
                </div>
                <p
                  v-if="!deployment.releases.length"
                  class="border-t border-default pt-3 text-sm text-muted"
                >
                  {{ t('releases.empty') }}
                </p>
              </section>

              <section
                v-if="deployment.infraItems.length"
                class="flex flex-col gap-2 rounded-lg border border-default bg-default p-4"
              >
                <div class="mb-1 flex items-center justify-between gap-2">
                  <h2 class="font-semibold text-highlighted">
                    {{ t('infra.title') }}
                  </h2>
                  <UButton
                    v-if="can('edit')"
                    icon="i-lucide-settings-2"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :label="t('overview.manage')"
                    :to="`${projectPath}?tab=infra`"
                  />
                </div>
                <InfraItemRow
                  v-for="item in deployment.infraItems"
                  :key="item.id"
                  :item="item"
                  :scope="item.environmentId ? undefined : null"
                />
              </section>

              <section class="flex flex-col gap-3 rounded-lg border border-default bg-default p-4">
                <h2 class="font-semibold text-highlighted">
                  {{ t('fields.notes') }}
                </h2>
                <RichTextEditor
                  v-model="notes"
                  :editable="can('edit')"
                  :placeholder="t('notes.placeholder')"
                />
                <template v-if="can('edit')">
                  <p class="text-xs text-warning">
                    {{ t('notes.warning') }}
                  </p>
                  <UButton
                    class="self-start"
                    size="sm"
                    :loading="notesSaving"
                    :label="t('common.save')"
                    @click="saveNotes"
                  />
                </template>
              </section>
            </aside>
          </div>
        </div>
      </template>
    </UDashboardPanel>

    <template v-if="deployment">
      <DeploymentFormModal
        v-model:open="editOpen"
        :deployment="deployment"
        @saved="refresh()"
      />
      <AccountFormModal
        v-model:open="accountOpen"
        :deployment-id="deployment.id"
        :account="editingAccount"
        @saved="reload()"
      />
      <ReleaseFormModal
        v-model:open="releaseOpen"
        :deployment-id="deployment.id"
        :release="editingRelease"
        @saved="refresh()"
      />
    </template>
  </div>
</template>
