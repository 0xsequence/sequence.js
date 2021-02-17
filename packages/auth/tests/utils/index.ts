
export function delay(time: number): Promise<void> {
  return new Promise((solve) => setTimeout(solve, time))
}
