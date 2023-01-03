import { OpenWalletIntent, ProviderRpcError, ProviderMessageResponse, ProviderMessage } from '../../types'
import { UrlMessageProviderHooks } from './url-message-provider'

export class BrowserRedirectMessageHooks implements UrlMessageProviderHooks {
  openWallet = (walletBaseUrl: string): void => {
    console.log('BrowserRedirectMessageHooks ....???... here...?')
    console.log('BrowserRedirectMessageHooks openWallet', walletBaseUrl)
    window.location.href = walletBaseUrl

    // on 0xsequence/react-native, we have to implement UrlMessageHooks
    // which will call InAppBrowser.open() etc.........
  }

  // responseFromRedirectUrl = (callback: (response: string) => void): void => {}
  responseFromRedirectUrl = (response: string) => {}
}
