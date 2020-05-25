import { ethers } from 'ethers'

import { TokenEncoder } from '../tokens/encoder'
import { GasReceipt } from '../tokens/types'

import { getBuyTokenData, getSellTokenData, NiftyswapMethods } from './types'

export class NiftyswapEncoder {
  baseCurrency: TokenEncoder
  asset: TokenEncoder

  signer: ethers.Signer
  constructor(
    public niftyswapExchangeAddress: string,
    _baseCurrencyContractAddress: string,
    _assetContractAddress: string,
    _signer: ethers.Signer
  ) {
    this.signer = _signer
    this.baseCurrency = new TokenEncoder(_baseCurrencyContractAddress, _signer)
    this.asset = new TokenEncoder(_assetContractAddress, _signer)
  }

  private getTargetEncoder = (method: NiftyswapMethods): TokenEncoder | null => {
    switch (method.type) {
      case 'buy':
        return this.baseCurrency
      case 'sell':
      case 'addLiquidity':
        return this.asset
      default:
        return null
    }
  }

  private encodeMethod = (method: NiftyswapMethods): string => {
    switch (method.type) {
      case 'buy':
        return getBuyTokenData({
          recipient: method.recipient,
          tokensBoughtIDs: method.tokenIdsToBuy,
          tokensBoughtAmounts: method.tokensAmountsToBuy,
          deadline: method.deadline
        })
      case 'sell':
        return getSellTokenData({
          recipient: method.recipient,
          minBaseTokens: method.cost,
          deadline: method.deadline
        })
      default:
        // TODO: addliquidity, remove liquidity
        return ''
    }
  }

  async encode(method: NiftyswapMethods, nonce: ethers.utils.BigNumber, gasReceipt?: GasReceipt): Promise<string | undefined> {
    const encoder = this.getTargetEncoder(method)
    const orderData = this.encodeMethod(method)

    switch (method.type) {
      case 'buy':
      case 'sell':
        return encoder?.encode(
          {
            type: 'metaSafeBatchTransferFrom',
            params: [this.niftyswapExchangeAddress, method.transferIds, method.transferAmounts]
          },
          {
            nonce,
            gasReceipt,
            extra: orderData
          }
        )
      default:
        // TODO: addliquidity, remove liquidity
        return undefined
    }
  }
}
