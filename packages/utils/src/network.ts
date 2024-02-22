import { ethers } from 'ethers'
import { url } from 'inspector'

export type ConnectionInfo = {
  url: string
  headers?: { [key: string]: string | number }

  user?: string
  password?: string

  allowInsecureAuthentication?: boolean
  allowGzip?: boolean

  throttleLimit?: number
  throttleSlotInterval?: number
  throttleCallback?: (attempt: number, url: string) => Promise<boolean>

  skipFetchSetup?: boolean
  fetchOptions?: Record<string, string>
  errorPassThrough?: boolean

  timeout?: number
}

// export const getEthersConnectionInfo = (url: string, projectAccessKey?: string, jwt?: string): ConnectionInfo => {
//   const headers: {
//     [key: string]: string | number
//   } = {}

//   if (jwt && jwt.length > 0) {
//     headers['Authorization'] = `BEARER ${jwt}`
//   }
//   if (projectAccessKey && projectAccessKey.length > 0) {
//     headers['X-Access-Key'] = projectAccessKey
//   }

//   return {
//     url,
//     headers,
//     skipFetchSetup: true,
//     fetchOptions: {
//       mode: 'cors',
//       cache: 'force-cache',
//       credentials: 'same-origin',
//       redirect: 'follow',
//       referrer: 'client'
//     }
//   }
// }

export const getEthersFetchRequest = (url: string, projectAccessKey?: string, jwt?: string): ethers.FetchRequest => {
  const req = new ethers.FetchRequest(url)

  if (jwt) {
    req.setHeader('Authorization', `BEARER ${jwt}`)
  }

  if (projectAccessKey) {
    req.setHeader('X-Access-Key', projectAccessKey)
  }

  return req
}
