import { EIP1193Provider, EIP1193ProviderFunc, JsonRpcMiddlewareHandler, JsonRpcRequest } from '../types'

export const SignerJsonRpcMethods = [
  'personal_sign',
  'eth_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'eth_sendTransaction',
  'eth_sendRawTransaction',
  'sequence_sign', // sequence-aware personal_sign
  'sequence_signTypedData_v4', // sequence-aware eth_signTypedData_v4

  'sequence_getWalletContext',
  'sequence_getWalletConfig',
  'sequence_getWalletState',
  'sequence_getNetworks',
  'sequence_updateConfig',
  'sequence_publishConfig',
  'sequence_gasRefundOptions',
  'sequence_getNonce',
  'sequence_relay',

  'eth_decrypt',
  'eth_getEncryptionPublicKey',
  'wallet_addEthereumChain',
  'wallet_switchEthereumChain',
  'wallet_registerOnboarding',
  'wallet_watchAsset',
  'wallet_scanQRCode'
]

export class SigningProvider implements JsonRpcMiddlewareHandler {
  private provider: EIP1193Provider

  constructor(provider: EIP1193Provider) {
    this.provider = provider
  }

  requestHandler = (next: EIP1193ProviderFunc) => {
    return (request: JsonRpcRequest): Promise<any> => {
      // Forward signing requests to the signing provider
      if (SignerJsonRpcMethods.includes(request.method)) {
        return this.provider.request(request)
      }

      // Continue to next handler
      return next(request)
    }
  }
}
