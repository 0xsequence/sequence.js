import { Web3Provider, AsyncSendable, TransactionRequest, TransactionResponse, JsonRpcSigner } from "ethers/providers"
import { Networkish, BigNumberish, Interface } from "ethers/utils"
import { toArcadeumTransactions, makeExpirable, makeAfterNonce, arcadeumTxAbiEncode } from "../utils"
import { NonceDependency, ArcadeumContext } from "../types"
import { abi as mainModuleAbi } from '../abi/mainModule'

export class ArcadeumWeb3Provider extends Web3Provider {
    private context: ArcadeumContext

    constructor(
        context: ArcadeumContext,
        web3Provider: AsyncSendable,
        network?: Networkish
    ) {
        super(web3Provider, network)
        this.context = context
    }

    getArcadeumSigner(): ArcadeumSigner {
        return new ArcadeumSigner(this.context, this.getSigner())
    }
}

export class ArcadeumSigner {
    private context: ArcadeumContext
    private signer: JsonRpcSigner

    constructor(
        context: ArcadeumContext,
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

        let arctxs = await toArcadeumTransactions(address, transactions, false)

        if (expiration) {
            arctxs = makeExpirable(this.context, arctxs, expiration)
        }

        if (dependencies && dependencies.length > 0) {
            arctxs = dependencies.reduce((p, d) => makeAfterNonce(this.context, p, d), arctxs)
        }

        const walletInterface = new Interface(mainModuleAbi)

        return this.signer.sendTransaction({
            to: address,
            data: walletInterface.functions.selfExecute.encode([arcadeumTxAbiEncode(arctxs)])
        })
    }
}
