import { BigNumberish, ethers, providers } from 'ethers'
import { Interface } from 'ethers/lib/utils'
import { Bridge, BridgeERC1155, BridgeERC20, BridgeNative, Move, MoveERC1155, MoveERC20, MoveEstimate, MoveNative } from '.'
import { ERC_20_ABI } from '../abi/erc20-abi'
import { MATIC_BRIDGE_ABI } from '../abi/matic-abi'
import { MaticPOSClient } from '@maticnetwork/maticjs'
import { ChainId, NetworkConfig } from '@0xsequence/network'
import { flatten, safeSolve } from '../utils'
import { ERC_1155_ABI } from '../abi/erc1155-abi'

type MaticBridgeConf = {
  parentId: number
  maticId: number
  networkName: string
  sdkVersion: string
  depositManager: string
  rootChainManager: string
  erc20Predicate: string
  erc1155Predicate: string
  maticToken: string
  etherPredicateProxy: string
}

export class MaticPosBridge implements BridgeNative, BridgeERC20, BridgeERC1155, Bridge {
  private static DEPOSIT_TOPIC_ERC20 = '0x9b217a401a5ddf7c4d474074aff9958a18d48690d77cc2151c4706aa7348b401'
  private static DEPOSIT_TOPIC_ERC1155 = '0x5a921678b5779e4471b77219741a417a6ad6ec5d89fa5c8ce8cd7bd2d9f34186'
  private static TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
  private static TRANSFER_ERC1155_TOPIC = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'
  private static DEPOSIT_ETH_TOPIC = '0x3e799b2d61372379e767ef8f04d65089179b7a6f63f9be3065806456c7309f1b'

  private static POS_TIME_DEPOSIT = 10 * 60
  private static POS_TIME_WITHDRAW = 30 * 60

  public static MAINNET_CONF: MaticBridgeConf = {
    parentId: ChainId.MAINNET,
    maticId: ChainId.POLYGON,
    networkName: 'mainnet',
    sdkVersion: 'v1',
    depositManager: '0x401F6c983eA34274ec46f84D70b31C151321188b',
    rootChainManager: '0xA0c68C638235ee32657e8f720a23ceC1bFc77C77',
    erc20Predicate: '0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf',
    erc1155Predicate: '0x0B9020d4E32990D67559b1317c7BF0C15D6EB88f',
    maticToken: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    etherPredicateProxy: '0x8484Ef722627bf18ca5Ae6BcF031c23E6e922B30'
  }

  private maticNet: NetworkConfig | undefined
  private parentNet: NetworkConfig | undefined

  private maticClient: ethers.providers.JsonRpcProvider
  private parentClient: ethers.providers.JsonRpcProvider

  constructor(private conf: MaticBridgeConf) {}

  name(): string {
    return 'Matic PoS bridge'
  }

  id(): string {
    return `matic-pos-${this.conf.parentId}-${this.conf.maticId}`
  }

  connect(networks: NetworkConfig[]): MaticPosBridge {
    this.maticNet = networks.find(n => n.chainId === this.conf.maticId)
    this.parentNet = networks.find(n => n.chainId === this.conf.parentId)
    this.maticClient = new ethers.providers.JsonRpcProvider(this.maticNet!.rpcUrl)
    this.parentClient = new ethers.providers.JsonRpcProvider(this.parentNet!.rpcUrl)
    return this
  }

  isDeposit(from: NetworkConfig, to: NetworkConfig): boolean {
    return from.chainId === this.conf.parentId && to.chainId === this.conf.maticId
  }

  isWithdraw(from: NetworkConfig, to: NetworkConfig): boolean {
    return from.chainId === this.conf.maticId && to.chainId === this.conf.parentId
  }

  isMaticToken(token: string): boolean {
    return ethers.utils.getAddress(token) === ethers.utils.getAddress(this.conf.maticToken)
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
      '0x0000000000000000000000000000000000001001',
      [
        {
          constant: true,
          inputs: [],
          name: 'lastStateId',
          outputs: [
            {
              name: '',
              type: 'uint256'
            }
          ],
          payable: false,
          stateMutability: 'view',
          type: 'function'
        }
      ],
      this.maticClient
    )

    return ethers.BigNumber.from((await contractInstance.functions.lastStateId())[0])
  }

  async isMapped(from: NetworkConfig, to: NetworkConfig, token: string): Promise<boolean> {
    const rootChain = new ethers.Contract(this.conf.rootChainManager, MATIC_BRIDGE_ABI, this.parentClient)

    // Check if token has child mapped
    if (this.isDeposit(from, to)) {
      const child = await safeSolve(rootChain.rootToChildToken(token), ethers.constants.AddressZero)
      return !!child && child !== ethers.constants.AddressZero
    }

    // Check if token has root mapped
    if (this.isWithdraw(from, to)) {
      const root = await safeSolve(rootChain.childToRootToken(token), ethers.constants.AddressZero)
      return !!root && root !== ethers.constants.AddressZero
    }

    return false
  }

  async getMoves(wallet: string, from: providers.BlockTag = 0, to: providers.BlockTag = 'latest'): Promise<Move[]> {
    return flatten(
      await Promise.all(
        [
          this._depositsNative(wallet, from, to),
          this._depositsERC20(wallet, from, to),
          this._withdrawsERC20(wallet, from, to),
          this._depositsERC1155(wallet, from, to)
          // TODO: Re-enable ERC1155 withdraws when matic.js get's patched
          // this._withdrawsERC1155(wallet, from, to)
        ].map((p: Promise<Move[]>) => safeSolve(p, []))
      )
    )
  }

  async supportsNative(from: NetworkConfig, to: NetworkConfig): Promise<boolean> {
    return this.isDeposit(from, to)
  }

  async estimateNative(from: NetworkConfig, to: NetworkConfig): Promise<MoveEstimate | undefined> {
    if (this.isDeposit(from, to)) {
      return {
        crossTime: MaticPosBridge.POS_TIME_DEPOSIT,
        steps: 1
      }
    }

    return undefined
  }

  async moveNative(
    from: NetworkConfig,
    to: NetworkConfig,
    dest: string,
    amount: BigNumberish
  ): Promise<providers.TransactionRequest[]> {
    if (this.isDeposit(from, to)) {
      return [
        {
          to: this.conf.rootChainManager,
          data: new Interface(MATIC_BRIDGE_ABI).encodeFunctionData('depositEtherFor', [dest]),
          value: amount
        }
      ]
    }

    return []
  }

  async completeNative(
    _from: NetworkConfig,
    _to: NetworkConfig,
    _txHash: string,
    _wallet: string
  ): Promise<providers.TransactionRequest[]> {
    return []
  }

  async _depositsNative(wallet: string, from: providers.BlockTag, to: providers.BlockTag): Promise<MoveNative[]> {
    const parentProvider = this.parentClient

    const lastStateId = this.lastStateId()

    const candidates = await parentProvider.getLogs({
      fromBlock: from,
      toBlock: to,
      address: this.conf.etherPredicateProxy,
      topics: [
        MaticPosBridge.DEPOSIT_ETH_TOPIC,
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet]),
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet])
      ]
    })

    return Promise.all(
      candidates.map(async cand => {
        const stateSyncId = await this.getStateSyncId(cand.transactionHash, cand.logIndex + 1)
        const isPending = stateSyncId!.gte(await lastStateId)

        return {
          ...cand,
          completeTx: undefined,
          isCompleted: !isPending,
          isPending: isPending,
          fromChainId: this.parentNet!.chainId,
          toChainId: this.maticNet!.chainId,
          amount: ethers.utils.defaultAbiCoder.decode(['uint256'], cand.data)[0]
        }
      })
    )
  }

  // ///
  // ERC20
  // ///

  async supportsERC20(from: NetworkConfig, to: NetworkConfig, token: string): Promise<boolean> {
    return this.isMapped(from, to, token)
  }

  async estimateERC20(from: NetworkConfig, to: NetworkConfig, token: string): Promise<MoveEstimate | undefined> {
    if (this.isDeposit(from, to)) {
      return {
        crossTime: MaticPosBridge.POS_TIME_DEPOSIT,
        steps: 1
      }
    }

    if (this.isWithdraw(from, to)) {
      return {
        crossTime: MaticPosBridge.POS_TIME_WITHDRAW,
        steps: 2
      }
    }

    return undefined
  }

  async moveERC20(
    from: NetworkConfig,
    to: NetworkConfig,
    token: string,
    src: string,
    dest: string,
    amount: BigNumberish
  ): Promise<providers.TransactionRequest[]> {
    if (this.isMaticToken(token)) {
      // Matic token must use the plasma bridge
      return []
    }

    if (this.isDeposit(from, to)) {
      const contractInstance = new ethers.Contract(token, ERC_20_ABI, this.parentClient)

      let allowance = ethers.constants.Zero
      try {
        allowance = await contractInstance.allowance(src, this.conf.erc20Predicate)
      } catch {}

      if (allowance.gte(amount)) {
        return [
          {
            to: this.conf.rootChainManager,
            gasLimit: 300000,
            data: new Interface(MATIC_BRIDGE_ABI).encodeFunctionData('depositFor', [
              dest,
              token,
              ethers.utils.defaultAbiCoder.encode(['uint256'], [amount])
            ])
          }
        ]
      } else {
        return [
          {
            to: token,
            data: new Interface(ERC_20_ABI).encodeFunctionData('approve', [
              this.conf.erc20Predicate,
              ethers.constants.MaxUint256
            ]),
            gasLimit: 75000
          },
          {
            to: this.conf.rootChainManager,
            gasLimit: 300000,
            data: new Interface(MATIC_BRIDGE_ABI).encodeFunctionData('depositFor', [
              dest,
              token,
              ethers.utils.defaultAbiCoder.encode(['uint256'], [amount])
            ])
          }
        ]
      }
    }

    if (this.isWithdraw(from, to)) {
      return [
        {
          to: token,
          data: new Interface(MATIC_BRIDGE_ABI).encodeFunctionData('withdraw', [amount])
        }
      ]
    }

    return []
  }

  async completeERC20(
    _from: NetworkConfig,
    _to: NetworkConfig,
    txHash: string,
    wallet: string
  ): Promise<providers.TransactionRequest[]> {
    const tx = await this.posClient.exitERC20(txHash, { from: wallet, encodeAbi: true })
    delete tx.nonce
    return [tx]
  }

  async _depositsERC20(wallet: string, from: providers.BlockTag, to: providers.BlockTag): Promise<MoveERC20[]> {
    const parentProvider = this.parentClient

    const lastStateId = this.lastStateId()

    const candidates = await parentProvider.getLogs({
      fromBlock: from,
      toBlock: to,
      address: this.conf.erc20Predicate,
      topics: [
        MaticPosBridge.DEPOSIT_TOPIC_ERC20,
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet]),
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet])
      ]
    })

    return Promise.all(
      candidates.map(async cand => {
        const stateSyncId = await this.getStateSyncId(cand.transactionHash, cand.logIndex + 2)
        const isPending = stateSyncId!.gte(await lastStateId)
        return {
          ...cand,
          completeTx: undefined,
          isCompleted: !isPending,
          isPending: isPending,
          fromChainId: this.parentNet!.chainId,
          toChainId: this.maticNet!.chainId,
          token: ethers.utils.defaultAbiCoder.decode(['address'], cand.topics[3])[0],
          amount: ethers.utils.defaultAbiCoder.decode(['uint256'], cand.data)[0]
        }
      })
    )
  }

  async _withdrawsERC20(wallet: string, from: providers.BlockTag, to: providers.BlockTag): Promise<MoveERC20[]> {
    const maitcProvider = this.maticClient

    const candidates = await maitcProvider.getLogs({
      fromBlock: from,
      toBlock: to,
      topics: [
        MaticPosBridge.TRANSFER_TOPIC,
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet]),
        ethers.utils.defaultAbiCoder.encode(['address'], [ethers.constants.AddressZero])
      ]
    })

    return Promise.all(
      candidates.map(async cand => {
        const isCompleted = await safeSolve(this.posClient.isERC20ExitProcessed(cand.transactionHash), false)
        const completeTx = !isCompleted
          ? safeSolve(this.completeERC20(this.maticNet!, this.parentNet!, cand.transactionHash, wallet), undefined)
          : undefined

        return {
          ...cand,
          completeTx: await completeTx,
          isCompleted: await isCompleted,
          isPending: !isCompleted && !(await completeTx),
          fromChainId: this.maticNet!.chainId,
          toChainId: this.parentNet!.chainId,
          token: cand.address,
          amount: ethers.utils.defaultAbiCoder.decode(['uint256'], cand.data)[0]
        }
      })
    )
  }

  // ///
  // ERC1155
  // ///

  supportsERC1155(from: NetworkConfig, to: NetworkConfig, token: string, _ids: BigNumberish[]): Promise<boolean> {
    return this.isMapped(from, to, token)
  }

  async estimateERC1155(
    from: NetworkConfig,
    to: NetworkConfig,
    token: string,
    ids: BigNumberish[]
  ): Promise<MoveEstimate | undefined> {
    if (this.isDeposit(from, to)) {
      return {
        crossTime: MaticPosBridge.POS_TIME_DEPOSIT,
        steps: 1
      }
    }

    if (this.isWithdraw(from, to)) {
      return {
        crossTime: MaticPosBridge.POS_TIME_WITHDRAW,
        steps: 2
      }
    }

    return undefined
  }

  async moveERC1155(
    from: NetworkConfig,
    to: NetworkConfig,
    token: string,
    dest: string,
    ids: BigNumberish[],
    amounts: BigNumberish[]
  ): Promise<ethers.providers.TransactionRequest[]> {
    const erc1155Interface = new Interface(ERC_1155_ABI)
    const maticBridgeInterface = new Interface(MATIC_BRIDGE_ABI)

    if (this.isDeposit(from, to)) {
      const encodedDeposit = ethers.utils.defaultAbiCoder.encode(['uint256[]', 'uint256[]', 'bytes'], [ids, amounts, '0x'])
      return [
        {
          to: token,
          data: erc1155Interface.encodeFunctionData('setApprovalForAll', [this.conf.erc1155Predicate, true]),
          gasLimit: 50000
        },
        {
          to: this.conf.rootChainManager,
          data: maticBridgeInterface.encodeFunctionData('depositFor', [dest, token, encodedDeposit]),
          gasLimit: 600000
        },
        {
          to: token,
          data: erc1155Interface.encodeFunctionData('setApprovalForAll', [this.conf.erc1155Predicate, false]),
          gasLimit: 50000
        }
      ]
    }

    if (this.isWithdraw(from, to)) {
      return [
        {
          to: token,
          data: maticBridgeInterface.encodeFunctionData('withdrawBatch', [ids, amounts])
        }
      ]
    }

    return []
  }

  async completeERC1155(
    from: NetworkConfig,
    to: NetworkConfig,
    txHash: string,
    wallet: string
  ): Promise<ethers.providers.TransactionRequest[]> {
    const tx = await this.posClient.exitBatchERC1155(txHash, { from: wallet, encodeAbi: true })
    delete tx.nonce
    return [tx]
  }

  async _depositsERC1155(wallet: string, from: providers.BlockTag, to: providers.BlockTag): Promise<MoveERC1155[]> {
    const parentProvider = this.parentClient

    const lastStateId = this.lastStateId()

    const candidates = await parentProvider.getLogs({
      fromBlock: from,
      toBlock: to,
      address: this.conf.erc1155Predicate,
      topics: [
        MaticPosBridge.DEPOSIT_TOPIC_ERC1155,
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet]),
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet])
      ]
    })

    return Promise.all(
      candidates.map(async cand => {
        const stateSyncId = await this.getStateSyncId(cand.transactionHash, cand.logIndex + 2)
        const isPending = stateSyncId!.gte(await lastStateId)
        const decodedData = ethers.utils.defaultAbiCoder.decode(['uint256[]', 'uint256[]'], cand.data)
        return {
          ...cand,
          completeTx: undefined,
          isCompleted: !isPending,
          isPending: isPending,
          fromChainId: this.parentNet!.chainId,
          toChainId: this.maticNet!.chainId,
          token: ethers.utils.defaultAbiCoder.decode(['address'], cand.topics[3])[0],
          ids: decodedData[0],
          amounts: decodedData[1]
        }
      })
    )
  }

  async _withdrawsERC1155(wallet: string, from: providers.BlockTag, to: providers.BlockTag): Promise<MoveERC1155[]> {
    const maitcProvider = this.maticClient

    const candidates = await maitcProvider.getLogs({
      fromBlock: from,
      toBlock: to,
      topics: [
        MaticPosBridge.TRANSFER_ERC1155_TOPIC,
        '',
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet]),
        ethers.utils.defaultAbiCoder.encode(['address'], [ethers.constants.AddressZero])
      ]
    })

    return Promise.all(
      candidates.map(async cand => {
        const isCompleted = await safeSolve(this.posClient.isBatchERC1155ExitProcessed(cand.transactionHash), false)
        const completeTx = !isCompleted
          ? safeSolve(this.completeERC1155(this.maticNet!, this.parentNet!, cand.transactionHash, wallet), undefined)
          : undefined
        const decodedData = ethers.utils.defaultAbiCoder.decode(['uint256[]', 'uint256[]'], cand.data)

        return {
          ...cand,
          completeTx: await completeTx,
          isCompleted: isCompleted,
          isPending: !isCompleted && !(await completeTx),
          fromChainId: this.maticNet!.chainId,
          toChainId: this.parentNet!.chainId,
          token: cand.address,
          amount: ethers.utils.defaultAbiCoder.decode(['uint256'], cand.data)[0],
          ids: decodedData[0],
          amounts: decodedData[1]
        }
      })
    )
  }

  // ///
  // Helpers
  // ///

  async getStateSyncId(hash: string, index: number): Promise<ethers.BigNumber | undefined> {
    const fullLogs = await this.parentClient.getTransactionReceipt(hash)
    const stateSyncLog = fullLogs.logs.find(l => l.logIndex === index)
    if (!stateSyncLog) return undefined
    const stateSyncId = ethers.utils.defaultAbiCoder.decode(['uint256'], stateSyncLog.topics[1])[0] as BigNumberish
    return ethers.BigNumber.from(stateSyncId)
  }
}
