export function useProject(id: MaybeRefOrGetter<string>) {
  return useFetch(() => `/api/projects/${toValue(id)}`, { key: `project-${toValue(id)}` })
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof useProject>>['data']['value']>
export type ProjectApp = ProjectDetail['apps'][number]
export type ProjectEnvironment = ProjectDetail['environments'][number]
export type ProjectLink = ProjectDetail['links'][number]

export function useTechStacks() {
  return useFetch('/api/tech-stacks', { key: 'tech-stacks', default: () => [] })
}

export type TechStack = Awaited<ReturnType<typeof useTechStacks>>['data']['value'][number]
