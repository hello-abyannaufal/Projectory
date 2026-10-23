<script setup lang="ts">
import type { InternalApi } from 'nitropack/types'

defineProps<{
  project: InternalApi['/api/projects']['get'][number]
}>()

const emit = defineEmits<{ togglePin: [] }>()

const { t, locale } = useI18n()
</script>

<template>
  <NuxtLink
    :to="`/projects/${project.id}`"
    class="group flex flex-col gap-3.5 rounded-lg border border-default bg-default p-5 transition hover:border-accented hover:shadow-sm"
  >
    <div class="flex items-start gap-3">
      <ProjectCover
        :name="project.name"
        :cover="project.cover"
      />
      <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span class="font-semibold text-highlighted">{{ project.name }}</span>
        <UBadge
          :color="projectStatusColor[project.status]"
          variant="subtle"
          :label="t(`projectStatus.${project.status}`)"
          class="rounded-full"
        />
      </div>
      <UTooltip :text="project.pinnedAt ? t('projects.unpin') : t('projects.pin')">
        <UButton
          :icon="project.pinnedAt ? 'i-lucide-pin-off' : 'i-lucide-pin'"
          :color="project.pinnedAt ? 'primary' : 'neutral'"
          variant="ghost"
          size="sm"
          :aria-label="project.pinnedAt ? t('projects.unpin') : t('projects.pin')"
          :class="!project.pinnedAt && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'"
          @click.prevent.stop="emit('togglePin')"
        />
      </UTooltip>
    </div>
    <p
      v-if="project.description"
      class="line-clamp-2 text-sm text-muted"
    >
      {{ project.description }}
    </p>
    <div
      v-if="project.techStacks.length"
      class="flex flex-wrap gap-1.5"
    >
      <span
        v-for="stack in project.techStacks"
        :key="stack.id"
        class="inline-flex items-center gap-1.5 rounded-md bg-elevated px-2 py-0.5 text-xs text-toned"
      >
        <TechStackIcon :stack="stack" />
        {{ stack.name }}
      </span>
    </div>
    <div class="mt-auto flex flex-wrap justify-between gap-2 border-t border-default pt-3 text-xs text-muted">
      <span>{{ project.platforms.map(p => t(`platform.${p}`)).join(' · ') || '—' }}</span>
      <span>
        {{ t('projects.appCount', project.appCount) }} · {{ t('projects.environmentCount', project.environmentCount) }} · {{ timeAgo(project.updatedAt, locale) }}
      </span>
    </div>
  </NuxtLink>
</template>
