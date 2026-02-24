import { Address, Hex, Secp256k1 } from 'ox'
import { describe, expect, it, vi } from 'vitest'
import {
  Erc1155ApprovalPrecondition,
  Erc1155BalancePrecondition,
  Erc20ApprovalPrecondition,
  Erc20BalancePrecondition,
  Erc721ApprovalPrecondition,
  Erc721OwnershipPrecondition,
  NativeBalancePrecondition,
} from '../../src/preconditions/types.js'
import {
  LocalRelayer,
  type GenericProvider,
} from '../../src/relayer/standard/local.js'
import { Network } from '@0xsequence/wallet-primitives'

const CAN_RUN_LIVE = false
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ERC20_IMPLICIT_MINT_CONTRACT = '0x041E0CDC028050519C8e6485B2d9840caf63773F'

function randomAddress(): Address.Address {
  return Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: Secp256k1.randomPrivateKey() }))
}

function createMockProvider(): GenericProvider {
  return {
    sendTransaction: vi.fn(),
    getBalance: vi.fn(),
    call: vi.fn(),
    getTransactionReceipt: vi.fn(),
  }
}

describe('Preconditions', () => {
  const getProvider = async (): Promise<{ provider: GenericProvider; chainId: number }> => {
    const chainId = Network.ChainId.MAINNET
    if (CAN_RUN_LIVE) {
      throw new Error('Live tests not configured: set up RPC and GenericProvider adapter')
    }
    const provider = createMockProvider()
    return { provider, chainId }
  }

  const testWalletAddress = randomAddress()

  const requireContractDeployed = async (_provider: GenericProvider, _contract: Address.Address) => {
    if (CAN_RUN_LIVE) {
      throw new Error('Live contract check not implemented')
    }
  }

  it('should create and check native balance precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider)

    const precondition = new NativeBalancePrecondition(
      testWalletAddress,
      1000000000000000000n, // 1 ETH min
      2000000000000000000n, // 2 ETH max
    )

    const transactionPrecondition = {
      type: precondition.type(),
      chainId,
      ownerAddress: precondition.address.toString(),
      tokenAddress: ZERO_ADDRESS,
      minAmount: precondition.min ?? 0n,
    }

    vi.mocked(provider.getBalance).mockResolvedValue(1500000000000000000n) // 1.5 ETH

    const isValid = await relayer.checkPrecondition(transactionPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC20 balance precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider)
    await requireContractDeployed(provider, Address.from(ERC20_IMPLICIT_MINT_CONTRACT))

    const precondition = new Erc20BalancePrecondition(
      testWalletAddress,
      Address.from(ERC20_IMPLICIT_MINT_CONTRACT),
      1000000n, // 1 token min
      2000000n, // 2 tokens max
    )

    const transactionPrecondition = {
      type: precondition.type(),
      chainId,
      ownerAddress: precondition.address.toString(),
      tokenAddress: precondition.token.toString(),
      minAmount: precondition.min ?? 0n,
    }

    vi.mocked(provider.call).mockResolvedValue('0x1e8480' as Hex.Hex) // 1.5 tokens in hex

    const isValid = await relayer.checkPrecondition(transactionPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC20 approval precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider)
    await requireContractDeployed(provider, Address.from(ERC20_IMPLICIT_MINT_CONTRACT))

    const operator = randomAddress()
    const precondition = new Erc20ApprovalPrecondition(
      testWalletAddress,
      Address.from(ERC20_IMPLICIT_MINT_CONTRACT),
      operator,
      1000000n, // 1 token min approval
    )

    const transactionPrecondition = {
      type: precondition.type(),
      chainId,
      ownerAddress: precondition.address.toString(),
      tokenAddress: precondition.token.toString(),
      minAmount: precondition.min,
    }

    vi.mocked(provider.call).mockResolvedValue('0x1e8480' as Hex.Hex) // 1.5 tokens in hex

    const isValid = await relayer.checkPrecondition(transactionPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC721 ownership precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider)
    await requireContractDeployed(provider, Address.from(ERC20_IMPLICIT_MINT_CONTRACT))

    const precondition = new Erc721OwnershipPrecondition(
      testWalletAddress,
      Address.from(ERC20_IMPLICIT_MINT_CONTRACT),
      1n, // tokenId
      true, // must own
    )

    const transactionPrecondition = {
      type: precondition.type(),
      chainId,
      ownerAddress: precondition.address.toString(),
      tokenAddress: precondition.token.toString(),
      minAmount: 0n,
    }

    vi.mocked(provider.call).mockResolvedValue(
      ('0x000000000000000000000000' + testWalletAddress.toString().slice(2).toLowerCase()) as Hex.Hex,
    )

    const isValid = await relayer.checkPrecondition(transactionPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC721 approval precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider)
    await requireContractDeployed(provider, Address.from(ERC20_IMPLICIT_MINT_CONTRACT))

    const operator = randomAddress()
    const precondition = new Erc721ApprovalPrecondition(
      testWalletAddress,
      Address.from(ERC20_IMPLICIT_MINT_CONTRACT),
      1n, // tokenId
      operator,
    )

    const transactionPrecondition = {
      type: precondition.type(),
      chainId,
      ownerAddress: precondition.address.toString(),
      tokenAddress: precondition.token.toString(),
      minAmount: 0n,
    }

    // getApproved returns 32-byte word: 12 zero bytes + 20-byte address. Codec uses ownerAddress as operator.
    const approvedHex =
      '0x' + '0'.repeat(24) + testWalletAddress.toString().slice(2).toLowerCase()
    vi.mocked(provider.call).mockResolvedValue(approvedHex as Hex.Hex)

    const isValid = await relayer.checkPrecondition(transactionPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC1155 balance precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider)
    await requireContractDeployed(provider, Address.from(ERC20_IMPLICIT_MINT_CONTRACT))

    const precondition = new Erc1155BalancePrecondition(
      testWalletAddress,
      Address.from(ERC20_IMPLICIT_MINT_CONTRACT),
      1n, // tokenId
      1000000n, // 1 token min
      2000000n, // 2 tokens max
    )

    const transactionPrecondition = {
      type: precondition.type(),
      chainId,
      ownerAddress: precondition.address.toString(),
      tokenAddress: precondition.token.toString(),
      minAmount: precondition.min ?? 0n,
    }

    vi.mocked(provider.call).mockResolvedValue('0x1e8480' as Hex.Hex) // 1.5 tokens in hex

    const isValid = await relayer.checkPrecondition(transactionPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC1155 approval precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider)
    await requireContractDeployed(provider, Address.from(ERC20_IMPLICIT_MINT_CONTRACT))

    const operator = randomAddress()
    const precondition = new Erc1155ApprovalPrecondition(
      testWalletAddress,
      Address.from(ERC20_IMPLICIT_MINT_CONTRACT),
      1n, // tokenId
      operator,
      1000000n, // 1 token min approval
    )

    const transactionPrecondition = {
      type: precondition.type(),
      chainId,
      ownerAddress: precondition.address.toString(),
      tokenAddress: precondition.token.toString(),
      minAmount: precondition.min,
    }

    vi.mocked(provider.call).mockResolvedValue('0x1' as Hex.Hex) // true

    const isValid = await relayer.checkPrecondition(transactionPrecondition)
    expect(isValid).toBe(true)
  })
})
