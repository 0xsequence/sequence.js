import { ethers } from 'ethers'

export const getDefaultConnectionInfo = (url: string): ethers.utils.ConnectionInfo => {
  return {
    url,
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
