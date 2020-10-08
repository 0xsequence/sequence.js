import { ExternalProvider } from '@ethersproject/providers'
import { ExternalWindowProvider } from './external-window-provider'
import { JsonRpcRequest, JsonRpcResponseCallback } from '../types'


export class SidechainProvider implements ExternalProvider {
    private parent: ExternalWindowProvider
    chainId: number

    constructor(parent: ExternalWindowProvider, chainId: number) {
        this.parent = parent
        this.chainId = chainId
    }

    sendAsync = async (request: JsonRpcRequest, callback: JsonRpcResponseCallback) => this.parent.sendAsync(request, callback, this.chainId)
}
