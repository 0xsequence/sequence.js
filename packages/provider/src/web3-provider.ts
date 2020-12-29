import { Web3Provider as EthersWeb3Provider, ExternalProvider, TransactionRequest, TransactionResponse, JsonRpcProvider, Networkish } from "@ethersproject/providers"
import { BigNumberish } from "ethers"
import { Interface } from "ethers/lib/utils"
import { walletContracts } from '@0xsequence/abi'
import { NonceDependency, toSequenceTransactions, makeExpirable, makeAfterNonce, sequenceTxAbiEncode } from '@0xsequence/transactions'
import { Networks, WalletContext, JsonRpcHandler, JsonRpcRequest, JsonRpcResponseCallback } from '@0xsequence/network'
import { Wallet, Signer } from '@0xsequence/wallet'
import { WalletRequestHandler } from './wallet-request-handler'

export class Web3Provider extends EthersWeb3Provider implements JsonRpcHandler {
  // TODO: context here should be optional..?
  // in fact, maybe shouldnt be provided at all..?
  private context: WalletContext

  // or could be just as an integrity check, for context we're expecting?
  // TODO: new methods... sequence_getWalletContext   .. sequence_getWalletConfig
  // etc........


  constructor(
    context: WalletContext,
    web3Provider: ExternalProvider,
    network?: Networkish
  ) {
    super(web3Provider, network)
    this.context = context
  }

  sendAsync(request: JsonRpcRequest, callback: JsonRpcResponseCallback | ((error: any, response: any) => void)) {
    this.send(request.method, request.params).then(r => {
      callback(undefined, {
        jsonrpc: '2.0',
        id: request.id,
        result: r
      })
    }).catch(e => callback(e, undefined))
  }

  // TODO: review.. should be sequence Signer type
  // getSequenceSigner(): Signer
  // getSequenceSigner(): SequenceSigner {
  //   return new SequenceSigner(this.context, this.getSigner())
  // }

  // TODO: ..
  // getSigner(): JsonRpcSigner {
  //   return new JsonRpcSigner(this)
  // }
}

export class LocalWeb3Provider extends Web3Provider {
  constructor(wallet: Wallet, networks: Networks) {
    const walletRequestHandler = new WalletRequestHandler(wallet, null, networks)
    super(wallet.context, walletRequestHandler)
  }
}

// TODO: prob move to signer.ts or json-rpc-signer.ts
// TODO: .. implenment Sequence Signer methods.

// .......
// @ts-ignore
export class JsonRpcSigner extends Signer { //implements TypedDataSigner {

  constructor(provider: JsonRpcProvider) {
    super()
  }

}

// yes, it should be the sequence "Signer"
// TODO: should implement an interface...... or..? review
// export class SequenceSigner {
//   private context: WalletContext
//   private signer: JsonRpcSigner

//   constructor(
//     context: WalletContext,
//     signer: JsonRpcSigner
//   ) {
//     this.context = context
//     this.signer = signer
//   }

//   async sendTransactionBatch(
//     transactions: TransactionRequest[],
//     expiration?: BigNumberish,
//     dependencies?: NonceDependency[]
//   ): Promise<TransactionResponse> {
//     const address = await this.signer.getAddress()

//     let arctxs = await toSequenceTransactions(address, transactions, false)

//     if (expiration) {
//       arctxs = makeExpirable(this.context, arctxs, expiration)
//     }

//     if (dependencies && dependencies.length > 0) {
//       arctxs = dependencies.reduce((p, d) => makeAfterNonce(this.context, p, d), arctxs)
//     }

//     const walletInterface = new Interface(walletContracts.mainModule.abi)

//     return this.signer.sendTransaction({
//       to: address,
//       data: walletInterface.encodeFunctionData(walletInterface.getFunction('selfExecute'), [sequenceTxAbiEncode(arctxs)])
//     })
//   }
// }
