export function useGateway(uri: string, gateway: string) {
  const clean = uri.replace('ipfs://ipfs/', '').replace('ipfs://', '')
  if (uri.startsWith('ipfs://')) return `${gateway}${clean}`
  return uri
}

export function isIPFS(uri: string): boolean {
  return uri.startsWith('ipfs://')
}
