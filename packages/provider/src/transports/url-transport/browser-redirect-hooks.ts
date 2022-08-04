import { OpenWalletIntent, ProviderRpcError, ProviderMessageResponse } from '../../types'
import { UrlMessageProviderHooks } from './url-message-provider'

export class BrowserRedirectMessageHooks implements UrlMessageProviderHooks {
  openWallet = (walletBaseUrl: string, path?: string, intent?: OpenWalletIntent, networkId?: string | number): void => {
    console.log('yeayyyyyyyyyyyyy')
    window.location.href = walletBaseUrl
    
    // on 0xsequence/react-native, we have to implement UrlMessageHooks
    // which will call InAppBrowser.open() etc.........
  }

  openWallet2(walletUrl: string): void {

  }

  async fetchResponseFromRedirectUrl(): Promise<{error?: ProviderRpcError, response?: ProviderMessageResponse}> {
    return {}
  }
}
