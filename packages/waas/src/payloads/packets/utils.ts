
export function useLifespan(lifespan: number) {
  const issued = Math.floor(Date.now() / 1000)
  return {
    issued,
    expires: issued + lifespan
  }
}
