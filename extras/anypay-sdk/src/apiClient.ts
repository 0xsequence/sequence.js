import { SequenceAPIClient } from '@0xsequence/api'
import { useMemo } from 'react'
import { useConfig } from '@0xsequence/hooks'

export { type SequenceAPIClient }

export function getAPIClient(apiUrl: string, projectAccessKey: string, jwt?: string) {
  return new SequenceAPIClient(apiUrl, projectAccessKey, jwt)
}

export const useAPIClient = () => {
  const { projectAccessKey, jwt, env } = useConfig()

  const apiClient = useMemo(() => {
    return getAPIClient(env.apiUrl, projectAccessKey, jwt)
  }, [projectAccessKey, jwt])

  return apiClient
}
