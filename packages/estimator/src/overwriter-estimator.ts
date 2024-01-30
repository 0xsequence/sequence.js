import { ethers } from 'ethers'
import { getEthersConnectionInfo, isBigIntish, BigIntish, Optionals, toHexString } from '@0xsequence/utils'

const GasEstimator = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/utils/GasEstimator.sol/GasEstimator.json')

function toQuantity(number: BigIntish | string): string {
  if (isBigIntish(number)) {
    return toHexString(BigInt(number))
  }

  return number
}

function tryDecodeError(bytes: ethers.BytesLike): string {
  try {
    return ethers.utils.toUtf8String('0x' + ethers.utils.hexlify(bytes).substr(138))
  } catch (e) {
    return 'UNKNOWN_ERROR'
  }
}

function toHexNumber(number: BigIntish): string {
  return toHexString(BigInt(number))
}

export type OverwriterEstimatorOptions = {
  rpc: string | ethers.providers.JsonRpcProvider
  dataZeroCost?: number
  dataOneCost?: number
  baseCost?: number
}

export const OverwriterEstimatorDefaults: Required<Optionals<OverwriterEstimatorOptions>> = {
  dataZeroCost: 4,
  dataOneCost: 16,
  baseCost: 21000
}

export class OverwriterEstimator {
  public provider: ethers.providers.JsonRpcProvider
  public options: Required<OverwriterEstimatorOptions>

  constructor(options: OverwriterEstimatorOptions) {
    this.provider =
      typeof options.rpc === 'string'
        ? new ethers.providers.StaticJsonRpcProvider(getEthersConnectionInfo(options.rpc))
        : options.rpc
    this.options = { ...OverwriterEstimatorDefaults, ...options }
  }

  txBaseCost(data: ethers.BytesLike): number {
    const bytes = ethers.utils.arrayify(data)
    return (
      Number(
        bytes.reduce((p, c) => (c == 0 ? p + BigInt(this.options.dataZeroCost) : p + BigInt(this.options.dataOneCost)), 0n)
      ) + this.options.baseCost
    )
  }

  async estimate(args: {
    to: string
    from?: string
    data?: ethers.BytesLike
    gasPrice?: BigIntish
    gas?: BigIntish
    overwrites?: {
      [address: string]: {
        code?: string
        balance?: BigIntish
        nonce?: BigIntish
        stateDiff?: {
          key: string
          value: string
        }[]
        state?: {
          key: string
          value: string
        }[]
      }
    }
    blockTag?: string | BigIntish
  }): Promise<bigint> {
    const blockTag = args.blockTag ? toQuantity(args.blockTag) : 'latest'
    const data = args.data ? args.data : []
    const from = args.from ? ethers.utils.getAddress(args.from) : ethers.Wallet.createRandom().address

    const gasEstimatorInterface = new ethers.utils.Interface(GasEstimator.abi)
    const encodedEstimate = gasEstimatorInterface.encodeFunctionData('estimate', [args.to, data])

    const providedOverwrites = args.overwrites
      ? Object.keys(args.overwrites).reduce((p, a) => {
          const address = ethers.utils.getAddress(a)
          const o = args.overwrites![a]

          if (address === from) {
            throw Error("Can't overwrite from address values")
          }

          return {
            ...p,
            [address]: {
              code: o.code ? ethers.utils.hexlify(o.code) : undefined,
              nonce: o.nonce ? toHexNumber(o.nonce) : undefined,
              balance: o.balance ? toHexNumber(o.balance) : undefined,
              state: o.state ? o.state : undefined,
              stateDiff: o.stateDiff ? o.stateDiff : undefined
            }
          }
        }, {})
      : {}

    const overwrites = {
      ...providedOverwrites,
      [from]: {
        code: GasEstimator.deployedBytecode
      }
    }

    const response = await this.provider.send('eth_call', [
      {
        to: from,
        data: encodedEstimate,
        gasPrice: args.gasPrice,
        gas: args.gas
      },
      blockTag,
      overwrites
    ])

    const decoded = gasEstimatorInterface.decodeFunctionResult('estimate', response)

    if (!decoded.success) {
      throw Error(`Failed gas estimation with ${tryDecodeError(decoded.result)}`)
    }

    return BigInt(decoded.gas) + BigInt(this.txBaseCost(data))
  }
}
