export const sleep = (t: number) => {
  return new Promise<void>(resolve => {
    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      resolve()
    }, t)
  })
}
