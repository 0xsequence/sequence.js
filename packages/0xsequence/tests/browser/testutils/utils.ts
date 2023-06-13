
export const delay = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const redirectRunKey = 'redirect-run'

export const redirectRun = (state: string) => {
  localStorage.setItem(redirectRunKey, state)
}

export const redirectRunState = () => {
  return localStorage.getItem(redirectRunKey)
}

// export const isRedirectRunCallback = () => {
//   return redirectRunState() === 'callback'
// }

export const redirectRunClear = () => {
  localStorage.removeItem(redirectRunKey)
}