import { SequenceAPIClient } from '@0xsequence/api'
import { useMemo } from 'react'
import { useConfig } from '@0xsequence/hooks'
import { DEFAULT_API_URL } from './constants.js'

export type APIClientConfig = {
  apiUrl?: string
  projectAccessKey?: string
  jwt?: string
}

export function getAPIClient({ apiUrl = DEFAULT_API_URL, projectAccessKey, jwt }: APIClientConfig): SequenceAPIClient {
  return new SequenceAPIClient(apiUrl as string, projectAccessKey, jwt)
}

export const useAPIClient = (config?: APIClientConfig) => {
  const { projectAccessKey, jwt, env } = useConfig()

  const apiClient = useMemo(() => {
    return getAPIClient({
      apiUrl: config?.apiUrl ?? env.apiUrl,
      projectAccessKey: config?.projectAccessKey ?? projectAccessKey,
      jwt: config?.jwt ?? jwt,
    })
  }, [projectAccessKey, jwt, env.apiUrl, config])

  return apiClient
}
