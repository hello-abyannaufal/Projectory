import type { InternalApi } from 'nitropack/types'

export function useDeployment(id: MaybeRefOrGetter<string>) {
  return useFetch<InternalApi['/api/deployments/:id']['get']>(() => `/api/deployments/${toValue(id)}`, { key: `deployment-${toValue(id)}` })
}

export type DeploymentDetail = NonNullable<Awaited<ReturnType<typeof useDeployment>>['data']['value']>
export type DeploymentAccount = DeploymentDetail['testAccounts'][number]
export type DeploymentRelease = DeploymentDetail['releases'][number]
export type DeploymentEnvVar = DeploymentDetail['envVars'][number]
