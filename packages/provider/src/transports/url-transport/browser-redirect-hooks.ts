import { OpenWalletIntent, ProviderRpcError, ProviderMessageResponse, ProviderMessage } from '../../types'
import { UrlMessageProviderHooks } from './url-message-provider'

export class BrowserRedirectMessageHooks implements UrlMessageProviderHooks {
  openWallet = (walletBaseUrl: string): void => {
    console.log('BrowserRedirectMessageHooks openWallet', walletBaseUrl)
    window.location.href = walletBaseUrl

    // on 0xsequence/react-native, we have to implement UrlMessageHooks
    // which will call InAppBrowser.open() etc.........
  }

  // listenResponseFromRedirectUrl(callback: (response: ProviderMessage<any>) => void): void {
  //   console.log('listenResponseFromRedirectUrl', window.location.href)
  //   // callback({
  //   //   idx: 1,
  //   //   type: 'something',
  //   //   data: {},
  //   //   chainId: undefined,
  //   //   origin: undefined
  //   // })
  // }
}
