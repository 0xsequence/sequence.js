import { ClientParams } from './client-params'

export async function getClientParams(state: string) {
  const clientParams = JSON.parse(sessionStorage.getItem(`client-params-${state}`) || '{}') as ClientParams
  return clientParams
}

export async function storeClientParams(state: string, clientParams: ClientParams) {
  sessionStorage.setItem(`client-params-${state}`, JSON.stringify(clientParams))
}
