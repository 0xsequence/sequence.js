import { BigNumberish, ethers, providers } from "ethers"
import { Interface } from "ethers/lib/utils"
import { Bridge, Move, MoveERC20, MoveEstimate, MoveNative } from "."
import { ERC_20_ABI } from "../abi/erc20-abi"
import { MATIC_BRIDGE_ABI } from "../abi/matic-abi"
import { MaticPOSClient } from '@maticnetwork/maticjs'
import { NetworkConfig } from '@arcadeum/provider'
import { flatten, safeSolve } from "../utils"

type MaticBridgeConf = {
  parentId: number,
  maticId: number,
  networkName: string,
  sdkVersion: string,
  depositManager: string,
  rootChainManager: string,
  erc20Predicate: string,
  maticToken: string,
  etherPredicateProxy: string
}

export class MaticBridge implements Bridge {
  private static DEPOSIT_TOPIC = "0x9b217a401a5ddf7c4d474074aff9958a18d48690d77cc2151c4706aa7348b401"
  private static TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
  private static DEPOSIT_ETH_TOPIC = "0x3e799b2d61372379e767ef8f04d65089179b7a6f63f9be3065806456c7309f1b"
  private static DEPOSIT_PLASMA_TOPIC = "0x1dadc8d0683c6f9824e885935c1bec6f76816730dcec148dda8cf25a7b9f797b"

  private static MATIC_NATIVE_TOKEN = "0x0000000000000000000000000000000000001010"

  private static PLASMA_TIME_DEPOSIT = 10 * 60
  private static PLASMA_TIME_WITHDRAW = 7 * 24 * 60 * 60
  private static POS_TIME_DEPOSIT = 10 * 60
  private static POS_TIME_WITHDRAW = 30 * 60

  public static MAINNET_CONF: MaticBridgeConf = {
    parentId: 1,
    maticId: 137,
    networkName: "mainnet",
    sdkVersion: "v1",
    depositManager: "0x401F6c983eA34274ec46f84D70b31C151321188b",
    rootChainManager: "0xA0c68C638235ee32657e8f720a23ceC1bFc77C77",
    erc20Predicate: "0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf",
    maticToken: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
    etherPredicateProxy: "0x8484Ef722627bf18ca5Ae6BcF031c23E6e922B30"
  }

  private maticNet: NetworkConfig | undefined
  private parentNet: NetworkConfig | undefined

  constructor(private conf: MaticBridgeConf) {}

  name(): string {
    return "Matic bridge"
  }

  id(): string {
    return `matic-${this.conf.parentId}-${this.conf.maticId}`
  }

  connect(networks: NetworkConfig[]): MaticBridge {
    this.maticNet = networks.find((n) => n.chainId === this.conf.maticId)
    this.parentNet = networks.find((n) => n.chainId === this.conf.parentId)
    return this
  }

  isDeposit(from: NetworkConfig, to: NetworkConfig): boolean {
    return from.chainId === this.conf.parentId && to.chainId === this.conf.maticId
  }

  isWithdraw(from: NetworkConfig, to: NetworkConfig): boolean {
    return from.chainId === this.conf.maticId && to.chainId === this.conf.parentId
  }

  isMaticToken(token: string): boolean {
    return token.toLowerCase() === this.conf.maticToken
  }

  get posClient() {
    return new MaticPOSClient({
      network: this.conf.networkName,
      version: this.conf.sdkVersion,
      parentProvider: this.parentNet?.rpcUrl,
      maticProvider: this.maticNet?.rpcUrl
    })
  }

  async lastStateId(): Promise<ethers.BigNumber> {
    const contractInstance = new ethers.Contract(
      "0x0000000000000000000000000000000000001001",
      [
        {
          constant: true,
          inputs: [],
          name: "lastStateId",
          outputs: [
            {
              name: "",
              type: "uint256"
            }
          ],
          payable: false,
          stateMutability: "view",
          type: "function"
        }
      ],
      new ethers.providers.JsonRpcProvider(this.maticNet.rpcUrl)
    )

    return ethers.BigNumber.from((await contractInstance.functions.lastStateId())[0])
  }

  async getMoves(wallet: string, from: providers.BlockTag = 0, to: providers.BlockTag = "latest"): Promise<Move[]> {
    return flatten(await Promise.all([
      this._depositsNative(wallet, from, to),
      this._depositsERC20(wallet, from, to),
      this._withdrawsERC20(wallet, from, to),
      this._depositsERC20Plasma(wallet, from, to)
    ].map((p) => safeSolve(p, []))))
  }

  async supportsNative(from: NetworkConfig, to: NetworkConfig): Promise<boolean> {
    return this.isWithdraw(from, to) // || this.isDeposit(from, to)
  }

  async estimateNative(from: NetworkConfig, to: NetworkConfig): Promise<MoveEstimate | undefined> {
    if (this.isDeposit(from, to)) {
      return {
        crossTime: MaticBridge.POS_TIME_DEPOSIT,
        steps: 1
      }
    }

    if (this.isWithdraw(from, to)) {
      return undefined

      // TODO: Re-enable handle complete
      // return {
      //   crossTime: MaticBridge.PLASMA_TIME_WITHDRAW,
      //   steps: 2
      // }
    }

    return undefined
  }

  async moveNative(from: NetworkConfig, to: NetworkConfig, dest: string, amount: BigNumberish): Promise<providers.TransactionRequest[]> {
    if (this.isDeposit(from, to)) {
      return [{
        to: this.conf.rootChainManager,
        data: new Interface(MATIC_BRIDGE_ABI).encodeFunctionData('depositEtherFor', [dest]),
        value: amount
      }]
    }
  
    if (this.isWithdraw(from, to)) {
      return [{
        to: MaticBridge.MATIC_NATIVE_TOKEN,
        data: new Interface(MATIC_BRIDGE_ABI).encodeFunctionData('withdraw', [amount])
      }]
    }

    return undefined
  }

  completeNative(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[]> {
    // TODO: Implement Plasma withdraw using Matic.js
    return undefined
  }

  async _depositsNative(wallet: string, from: providers.BlockTag, to: providers.BlockTag): Promise<MoveNative[]> {
    const parentProvider = new ethers.providers.JsonRpcProvider(this.parentNet.rpcUrl)

    const lastStateId = this.lastStateId()

    const candidates = await parentProvider.getLogs({
      fromBlock: from,
      toBlock: to,
      address: this.conf.erc20Predicate,
      topics: [
        MaticBridge.DEPOSIT_ETH_TOPIC,
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet]),
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet])
      ]
    })

    return Promise.all(candidates.map(async (cand) => {
      const stateSyncId = await this.getStateSyncId(cand.transactionHash, cand.logIndex + 1)
      const isPending = stateSyncId.lt(await lastStateId)

      return {
        ...cand,
        completeTx: undefined,
        isCompleted: !isPending,
        isPending: isPending,
        fromChain: this.parentNet.chainId,
        toChain: this.maticNet.chainId,
        token: cand.address,
        amount: ethers.utils.defaultAbiCoder.decode(['uint256'], cand.data)[0]
      }
    }))
  }

  // ///
  // ERC20
  // ///

  async supportsERC20(from: NetworkConfig, to: NetworkConfig, token: string): Promise<boolean> {
    // TODO: Check if token is mapped on Matic
    return await this.moveERC20(from, to, token, undefined, 0) !== undefined
  }

  async estimateERC20(from: NetworkConfig, to: NetworkConfig, token: string): Promise<MoveEstimate> {
    if (this.isDeposit(from, to)) {
      return {
        crossTime: MaticBridge.POS_TIME_DEPOSIT,
        steps: 1
      }
    }

    if (this.isWithdraw(from, to)) {
      return {
        crossTime: MaticBridge.POS_TIME_WITHDRAW,
        steps: 2
      }
    }

    return undefined
  }

  async moveERC20(from: NetworkConfig, to: NetworkConfig, token: string, dest: string, amount: BigNumberish): Promise<providers.TransactionRequest[]> {
    if (this.isDeposit(from, to)) {
      if (this.isMaticToken(token)) {
        // Use Plasma bridge
        return [{
          to: token,
          data: new Interface(ERC_20_ABI).encodeFunctionData('approve', [this.conf.depositManager, amount])
        }, {
          to: this.conf.depositManager,
          data: new Interface(MATIC_BRIDGE_ABI).encodeFunctionData('depositERC20ForUser', [this.conf.maticToken, dest, amount])
        }]
      } else {
        // Use PoS bridge
        return [{
          to: token,
          data: new Interface(ERC_20_ABI).encodeFunctionData('approve', [this.conf.erc20Predicate, amount])
        }, {
          to: this.conf.rootChainManager,
          data: new Interface(MATIC_BRIDGE_ABI).encodeFunctionData('depositERC20ForUser', [this.conf.maticToken, dest, amount])
        }]
      }
    }

    if (this.isWithdraw(from, to)) {
      return [{
        to: token,
        data: new Interface(MATIC_BRIDGE_ABI).encodeFunctionData('withdraw', [amount])
      }]
    }

    return undefined
  }

  async completeERC20(_from: NetworkConfig, _to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[]> {
    return [await this.posClient.exitERC20(txHash, { from: wallet, encodeAbi: true })]
  }

  async _depositsERC20(wallet: string, from: providers.BlockTag, to: providers.BlockTag): Promise<MoveERC20[]> {
    const parentProvider = new ethers.providers.JsonRpcProvider(this.parentNet.rpcUrl)

    const lastStateId = this.lastStateId()

    const candidates = await parentProvider.getLogs({
      fromBlock: from,
      toBlock: to,
      address: this.conf.erc20Predicate,
      topics: [
        MaticBridge.DEPOSIT_TOPIC,
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet]),
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet])
      ]
    })

    return Promise.all(candidates.map(async (cand) => {
      const stateSyncId = await this.getStateSyncId(cand.transactionHash, cand.logIndex + 2)
      const isPending = stateSyncId.lt(await lastStateId)

      return {
        ...cand,
        completeTx: undefined,
        isCompleted: !isPending,
        isPending: isPending,
        fromChain: this.parentNet.chainId,
        toChain: this.maticNet.chainId,
        token: cand.address,
        amount: ethers.utils.defaultAbiCoder.decode(['uint256'], cand.data)[0]
      }
    }))
  }

  async _depositsERC20Plasma(wallet: string, from: providers.BlockTag, to: providers.BlockTag): Promise<MoveERC20[]> {
    const parentProvider = new ethers.providers.JsonRpcProvider(this.parentNet.rpcUrl)

    const lastStateId = this.lastStateId()

    const candidates = await parentProvider.getLogs({
      fromBlock: from,
      toBlock: to,
      address: this.conf.depositManager,
      topics: [
        MaticBridge.DEPOSIT_PLASMA_TOPIC,
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet])
      ]
    })

    return Promise.all(candidates.map(async (cand) => {
      const stateSyncId = await this.getStateSyncId(cand.transactionHash, cand.logIndex - 1)
      const isPending = stateSyncId.lt(await lastStateId)

      return {
        ...cand,
        completeTx: undefined,
        isCompleted: !isPending,
        isPending: isPending,
        fromChain: this.parentNet.chainId,
        toChain: this.maticNet.chainId,
        token: cand.address,
        amount: ethers.utils.defaultAbiCoder.decode(['uint256'], cand.data)[0]
      }
    }))
  }

  async _withdrawsERC20(wallet: string, from: providers.BlockTag, to: providers.BlockTag): Promise<MoveERC20[]> {
    const maitcProvider = new ethers.providers.JsonRpcProvider(this.maticNet.rpcUrl)

    const candidates = await maitcProvider.getLogs({
      fromBlock: from,
      toBlock: to,
      topics: [
        MaticBridge.TRANSFER_TOPIC,
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet]),
        ethers.utils.defaultAbiCoder.encode(['address'], [ethers.constants.AddressZero])
      ]
    })

    return Promise.all(candidates.map(async (cand) => {
      const isCompleted = (async () => {
        try {
          return await this.posClient.isERC20ExitProcessed(cand.transactionHash)
        } catch {}
        return false
      })()
  
      const completeTx = (async () => {
        try {
          return await this.completeERC20(this.maticNet, this.parentNet, wallet, cand.transactionHash)
        } catch {}
        return undefined
      })()

      return {
        ...cand,
        completeTx: await completeTx,
        isCompleted: await isCompleted,
        isPending: !(await isCompleted) && !(await completeTx),
        fromChain: this.maticNet.chainId,
        toChain: this.parentNet.chainId,
        token: cand.address,
        amount: ethers.utils.defaultAbiCoder.decode(['uint256'], cand.data)[0]
      }
    }))
  }

  // ///
  // ERC1155
  // ///

  supportsERC1155(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<boolean> {
    throw new Error("Method not implemented.")
  }

  estimateERC1155(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<MoveEstimate> {
    throw new Error("Method not implemented.")
  }

  moveERC1155(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[], amounts: BigNumberish[]): Promise<providers.TransactionRequest[]> {
    throw new Error("Method not implemented.")
  }

  completeERC1155(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[]> {
    throw new Error("Method not implemented.")
  }

  // ///
  // ERC721
  // ///

  supportsERC721(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<boolean> {
    throw new Error("Method not implemented.")
  }

  estimateERC721(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<MoveEstimate> {
    throw new Error("Method not implemented.")
  }

  moveERC721(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<providers.TransactionRequest[]> {
    throw new Error("Method not implemented.")
  }

  completeERC721(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[]> {
    throw new Error("Method not implemented.")
  }

  // ///
  // Helpers
  // ///

  async getStateSyncId(hash: string, index: number): Promise<ethers.BigNumber | undefined> {
    const fullLogs = await new ethers.providers.JsonRpcProvider(this.parentNet.rpcUrl).getTransactionReceipt(hash)
    const stateSyncLog = fullLogs.logs.find((l) => l.logIndex === index)
    if (!stateSyncLog) return undefined
    const stateSyncId = ethers.utils.defaultAbiCoder.decode(['uint256'], stateSyncLog.topics[1])[0] as BigNumberish
    return ethers.BigNumber.from(stateSyncId)
  }
}
