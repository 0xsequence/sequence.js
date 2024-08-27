export function useLifespan(lifespan: number) {
  const issuedAt = Math.floor(Date.now() / 1000)
  return {
    issuedAt,
    expiresAt: issuedAt + lifespan
  }
}
