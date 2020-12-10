import { Web3Provider as EthersWeb3Provider, ExternalProvider, TransactionRequest, TransactionResponse, JsonRpcSigner, Networkish } from "@ethersproject/providers"
import { BigNumberish } from "ethers"
import { Interface } from "ethers/lib/utils"
import { walletContracts } from '@0xsequence/abi'
import { NonceDependency, toSequenceTransactions, makeExpirable, makeAfterNonce, sequenceTxAbiEncode } from '@0xsequence/transactions'
import { WalletContext } from '@0xsequence/networks'

export class Web3Provider extends EthersWeb3Provider {
  private context: WalletContext

  constructor(
    context: WalletContext,
    web3Provider: ExternalProvider,
    network?: Networkish
  ) {
    super(web3Provider, network)
    this.context = context
  }

  getSequenceSigner(): SequenceSigner {
    return new SequenceSigner(this.context, this.getSigner())
  }
}

// TODO: should implement an interface
export class SequenceSigner {
  private context: WalletContext
  private signer: JsonRpcSigner

  constructor(
    context: WalletContext,
    signer: JsonRpcSigner
  ) {
    this.context = context
    this.signer = signer
  }

  async sendTransactionBatch(
    transactions: TransactionRequest[],
    expiration?: BigNumberish,
    dependencies?: NonceDependency[]
  ): Promise<TransactionResponse> {
    const address = await this.signer.getAddress()

    let arctxs = await toSequenceTransactions(address, transactions, false)

    if (expiration) {
      arctxs = makeExpirable(this.context, arctxs, expiration)
    }

    if (dependencies && dependencies.length > 0) {
      arctxs = dependencies.reduce((p, d) => makeAfterNonce(this.context, p, d), arctxs)
    }

    const walletInterface = new Interface(walletContracts.mainModule.abi)

    return this.signer.sendTransaction({
      to: address,
      data: walletInterface.encodeFunctionData(walletInterface.getFunction('selfExecute'), [sequenceTxAbiEncode(arctxs)])
    })
  }
}
