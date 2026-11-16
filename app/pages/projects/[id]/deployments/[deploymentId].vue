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

// The .env file shown; falls back to the first when the chosen one is gone.
const envFileId = ref<string>()
const envFile = computed(() => deployment.value?.envFiles.find(file => file.id === envFileId.value) ?? deployment.value?.envFiles[0])
const envFileFormOpen = ref(false)

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

async function duplicateAccount(account: DeploymentAccount, targetId?: string) {
  if (await api(() => request(`/api/accounts/${account.id}/duplicate`, { method: 'POST', body: targetId ? { deploymentId: targetId } : undefined }))) {
    const target = deployment.value?.siblings.find(sibling => sibling.id === targetId)
    if (target) {
      toast.add({ title: t('accounts.duplicatedTo', { name: target.name }), color: 'success' })
    }
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
    lines.push('', ...accountTextLines(account, secrets))
  }
  await copy(lines.join('\n'))
}

// Shares accounts as text (copied) or JSON (downloaded). Secrets are revealed,
// and so recorded in the audit log, only when asked for.
async function shareAccounts(accounts: DeploymentAccount[], format: 'text' | 'json', withSecrets: boolean, name: string) {
  const value = deployment.value
  if (!value) {
    return
  }
  const items: { account: DeploymentAccount, secrets?: Record<string, string> }[] = []
  for (const account of accounts) {
    const secrets = withSecrets ? await loadSecrets(account.id)() : undefined
    if (withSecrets && !secrets) {
      return
    }
    items.push({ account, secrets })
  }
  if (format === 'json') {
    const filename = `${value.app.name}-${value.environment.name}-${name}`.replace(/[^\w.-]+/g, '-')
    downloadText(`${filename}.json`, accountsJson({ app: value.app.name, environment: value.environment.name }, items), 'application/json')
  } else {
    await copy([`${value.app.name} — ${value.environment.name}`, ...items.flatMap(({ account, secrets }) => ['', ...accountTextLines(account, secrets)])].join('\n'))
  }
}

// Dev files of the app, shared by all its environments
const filesOpen = ref(false)
const filesSelected = ref<string>()

function openFiles(fileId?: string) {
  filesSelected.value = fileId
  filesOpen.value = true
}

const copyItems = computed(() => [[
  { label: t('deployments.copyWithoutSecrets'), icon: 'i-lucide-shield', onSelect: () => copyAsText(false) },
  ...(isProduction.value || !can('viewSecrets') ? [] : [{ label: t('deployments.copyWithSecrets'), icon: 'i-lucide-shield-alert', onSelect: () => copyAsText(true) }])
], [
  { label: t('accounts.downloadJson'), icon: 'i-lucide-file-json', onSelect: () => shareAccounts(deployment.value?.testAccounts ?? [], 'json', false, 'accounts') },
  ...(isProduction.value || !can('viewSecrets') ? [] : [{ label: t('accounts.downloadJsonSecrets'), icon: 'i-lucide-file-json', onSelect: () => shareAccounts(deployment.value?.testAccounts ?? [], 'json', true, 'accounts') }])
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
                :label="t('deployments.export')"
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
                    :key="account.id"
                    v-bind="accountSort.item(index)"
                    :account="account"
                    :drag-handle="can('edit') ? accountSort.handle(index) : undefined"
                    :editable="can('edit')"
                    :can-reveal="can('viewSecrets')"
                    :siblings="deployment.siblings"
                    :deployment-id="deployment.id"
                    :class="accountSort.dragging.value === index && 'opacity-50'"
                    :load-secrets="loadSecrets(account.id)"
                    @edit="openAccount(account)"
                    @duplicate="targetId => duplicateAccount(account, targetId)"
                    @delete="deleteAccount(account)"
                    @share="(format, withSecrets) => shareAccounts([account], format, withSecrets, account.label)"
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

              <div
                v-if="!isProduction"
                class="flex flex-col gap-3"
              >
                <div
                  v-if="deployment.envFiles.length > 1 || can('edit')"
                  class="flex flex-wrap items-center gap-2"
                >
                  <UTabs
                    v-if="deployment.envFiles.length > 1"
                    :model-value="envFile?.id"
                    :items="deployment.envFiles.map(file => ({ label: file.path, value: file.id }))"
                    :content="false"
                    size="xs"
                    @update:model-value="envFileId = String($event)"
                  />
                  <UButton
                    v-if="can('edit')"
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    :label="t('env.addFile')"
                    @click="envFileFormOpen = true"
                  />
                </div>
                <EnvSection
                  v-if="envFile"
                  :key="envFile.id"
                  :deployment-id="deployment.id"
                  :file-id="envFile.id"
                  :path="envFile.path"
                  :env-vars="envFile.envVars"
                  :editable="can('edit')"
                  :can-reveal="can('viewSecrets')"
                  :environment-name="deployment.environment.name"
                  :siblings="deployment.siblings"
                  @changed="refresh()"
                />
                <p
                  v-else
                  class="rounded-lg border border-dashed border-accented p-6 text-center text-sm text-muted"
                >
                  {{ t('env.noFiles') }}
                </p>
                <EnvFileFormModal
                  v-model:open="envFileFormOpen"
                  :deployment-id="deployment.id"
                  @saved="refresh()"
                />
              </div>

              <section
                v-if="!isProduction"
                class="flex flex-col gap-2 rounded-lg border border-default bg-default p-4"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex min-w-0 flex-col">
                    <h2 class="font-semibold text-highlighted">
                      {{ t('appFiles.title') }}
                    </h2>
                    <span class="text-xs text-muted">{{ t('appFiles.sharedHint', { name: deployment.app.name }) }}</span>
                  </div>
                  <UButton
                    :icon="can('edit') && !deployment.app.files.length ? 'i-lucide-plus' : 'i-lucide-settings-2'"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    :label="can('edit') && !deployment.app.files.length ? t('appFiles.new') : t('appFiles.manage')"
                    @click="openFiles()"
                  />
                </div>
                <div
                  v-for="file in deployment.app.files"
                  :key="file.id"
                  class="flex items-center gap-3 border-t border-default pt-2"
                >
                  <UIcon
                    name="i-lucide-file-code"
                    class="size-4 shrink-0 text-muted"
                  />
                  <span class="min-w-0 flex-1 truncate font-mono text-sm text-highlighted">{{ file.path }}</span>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :label="t('appFiles.open')"
                    :disabled="!can('viewSecrets')"
                    @click="openFiles(file.id)"
                  />
                </div>
                <p
                  v-if="!deployment.app.files.length"
                  class="border-t border-default pt-2 text-sm text-muted"
                >
                  {{ t('appFiles.empty') }}
                </p>
              </section>
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
                v-if="deployment.links.length"
                class="flex flex-col gap-1 rounded-lg border border-default bg-default p-4"
              >
                <div class="mb-2 flex items-center justify-between gap-2">
                  <h2 class="font-semibold text-highlighted">
                    {{ t('links.title') }}
                  </h2>
                  <UButton
                    v-if="can('edit')"
                    icon="i-lucide-settings-2"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :label="t('overview.manage')"
                    :to="`${projectPath}?tab=links`"
                  />
                </div>
                <a
                  v-for="link in deployment.links"
                  :key="link.id"
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="group flex items-center gap-3 border-t border-default py-2.5"
                >
                  <UBadge
                    color="neutral"
                    variant="soft"
                    :label="t(`linkType.${link.type}`)"
                  />
                  <span class="min-w-0 flex-1 truncate text-sm text-highlighted group-hover:text-primary">{{ link.label }}</span>
                </a>
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
      <AppFilesModal
        v-model:open="filesOpen"
        :app-id="deployment.app.id"
        :app-name="deployment.app.name"
        :file-id="filesSelected"
        :editable="can('edit')"
        :can-reveal="can('viewSecrets')"
        @changed="refresh()"
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
