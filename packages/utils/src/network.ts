import { ethers } from 'ethers'

export const getEthersConnectionInfo = (url: string, projectAccessKey?: string, jwt?: string): ethers.utils.ConnectionInfo => {
  const headers: {
    [key: string]: string | number
  } = {}

  if (jwt && jwt.length > 0) {
    headers['Authorization'] = `BEARER ${jwt}`
  }
  if (projectAccessKey && projectAccessKey.length > 0) {
    headers['X-Access-Key'] = projectAccessKey
  }

  return {
    url,
    headers,
    skipFetchSetup: true,
    fetchOptions: {
      mode: 'cors',
      cache: 'force-cache',
      credentials: 'same-origin',
      redirect: 'follow',
      referrer: 'client'
    }
  }
}
