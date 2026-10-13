import type { InternalApi } from 'nitropack/types'

// Explicit type: `/api/projects/${id}` would also match `/api/projects/import`.
export function useProject(id: MaybeRefOrGetter<string>) {
  return useFetch<InternalApi['/api/projects/:id']['get']>(() => `/api/projects/${toValue(id)}`, { key: `project-${toValue(id)}` })
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof useProject>>['data']['value']>
export type ProjectApp = ProjectDetail['apps'][number]
export type ProjectEnvironment = ProjectDetail['environments'][number]
export type ProjectLink = ProjectDetail['links'][number]
export type ProjectInfraItem = ProjectDetail['infraItems'][number]

export function useTechStacks() {
  return useFetch('/api/tech-stacks', { key: 'tech-stacks', default: () => [] })
}

export type TechStack = Awaited<ReturnType<typeof useTechStacks>>['data']['value'][number]

export function useGroups() {
  return useFetch('/api/groups', { key: 'groups', default: () => [] })
}

export type Group = Awaited<ReturnType<typeof useGroups>>['data']['value'][number]
