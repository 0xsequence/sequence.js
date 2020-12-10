import { ExternalProvider } from '@ethersproject/providers'
import { JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/provider'
import { ProviderTransport } from './types'

// SidechainProvider is a kind of wrapper around an json-rpc provider, which uses
// the ProviderTransport interface, so that we can include the extra "chainId"
// field when messaging over the json-rpc provider for multi-chain support in the wallet.
export class SidechainProvider implements ExternalProvider {
  private transport: ProviderTransport
  chainId: number

  constructor(transport: ProviderTransport, chainId: number) {
    this.transport = transport
    this.chainId = chainId
  }

  sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => this.transport.sendAsync(request, callback, this.chainId)
}
