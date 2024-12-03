import { getLocalTime } from './base'

export function useLifespan(lifespan: number) {
  const issuedAt = Math.floor(getLocalTime() / 1000)
  return {
    issuedAt,
    expiresAt: issuedAt + lifespan
  }
}
