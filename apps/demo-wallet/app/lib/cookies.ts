import { cookies } from 'next/headers'
import { ClientParams } from './client-params'

export async function getClientParams(state: string) {
  const cookieStore = await cookies()
  const clientParams = JSON.parse(cookieStore.get(`client-params-${state}`)?.value || '{}') as ClientParams
  return clientParams
}

export async function storeClientParams(state: string, searchParams: URLSearchParams) {
  const cookieStore = await cookies()
  const clientParams: ClientParams = {
    app_id: searchParams.get('app_id') || '',
    redirect_uri: searchParams.get('redirect_uri') || '',
    session_address: searchParams.get('session_address') || '',
    state: searchParams.get('state') || '',
  }
  cookieStore.set(`client-params-${state}`, JSON.stringify(clientParams))
}
