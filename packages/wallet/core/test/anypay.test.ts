import { Address, Bytes, Provider, Hex, RpcTransport, Secp256k1, AbiFunction } from 'ox'
import { Context, Payload } from '@0xsequence/wallet-primitives'
import { LocalRelayer } from '../src/relayer/local'
import { describe, it, expect, vi } from 'vitest'
import { isAddressEqual } from 'viem'
import {
  NativeBalancePrecondition,
  Erc20BalancePrecondition,
  Erc20ApprovalPrecondition,
  Erc721OwnershipPrecondition,
  Erc721ApprovalPrecondition,
  Erc1155BalancePrecondition,
  Erc1155ApprovalPrecondition,
} from '../src/preconditions/types'
import { CAN_RUN_LIVE, RPC_URL } from './constants'
import { calculateIntentConfigurationAddress, IntentCallsPayload } from '../src/anypay/intents'

const ERC20_IMPLICIT_MINT_CONTRACT = '0x041E0CDC028050519C8e6485B2d9840caf63773F'

function randomAddress(): Address.Address {
  return Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: Secp256k1.randomPrivateKey() }))
}

describe('AnyPay Preconditions', () => {
  const getProvider = async (): Promise<{ provider: Provider.Provider; chainId: bigint }> => {
    let provider: Provider.Provider
    let chainId = 1n
    if (CAN_RUN_LIVE) {
      provider = Provider.from(RpcTransport.fromHttp(RPC_URL!!))
      chainId = BigInt(await provider.request({ method: 'eth_chainId' }))
    } else {
      provider = {
        request: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
        call: vi.fn(),
        sendTransaction: vi.fn(),
        getBalance: vi.fn(),
      } as unknown as Provider.Provider
    }

    return { provider: provider!, chainId }
  }

  const testWalletAddress = randomAddress()
  const testIdentityAddress = randomAddress()

  const requireContractDeployed = async (provider: Provider.Provider, contract: Address.Address) => {
    const code = await provider.request({ method: 'eth_getCode', params: [contract, 'latest'] })
    if (code === '0x') {
      throw new Error(`Contract ${contract} not deployed`)
    }
  }

  it('should create and check native balance precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider as any)

    const precondition = new NativeBalancePrecondition(
      testWalletAddress,
      1000000000000000000n, // 1 ETH min
      2000000000000000000n, // 2 ETH max
    )

    const intentPrecondition = {
      type: precondition.type(),
      chainId: chainId.toString(),
      data: JSON.stringify({
        address: precondition.address.toString(),
        min: precondition.min?.toString(),
        max: precondition.max?.toString(),
      }),
    }

    if (!CAN_RUN_LIVE) {
      // Mock the balance check
      ;(provider as any).request.mockResolvedValue('0x16345785d8a0000') // 1.5 ETH in hex
    }

    const isValid = await relayer.checkPrecondition(intentPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC20 balance precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider as any)
    await requireContractDeployed(provider, ERC20_IMPLICIT_MINT_CONTRACT)

    const precondition = new Erc20BalancePrecondition(
      testWalletAddress,
      ERC20_IMPLICIT_MINT_CONTRACT,
      1000000n, // 1 token min
      2000000n, // 2 tokens max
    )

    const intentPrecondition = {
      type: precondition.type(),
      chainId: chainId.toString(),
      data: JSON.stringify({
        address: precondition.address.toString(),
        token: precondition.token.toString(),
        min: precondition.min?.toString(),
        max: precondition.max?.toString(),
      }),
    }

    if (!CAN_RUN_LIVE) {
      // Mock the balanceOf call
      ;(provider as any).call.mockResolvedValue('0x1e8480') // 1.5 tokens in hex
    }

    const isValid = await relayer.checkPrecondition(intentPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC20 approval precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider as any)
    await requireContractDeployed(provider, ERC20_IMPLICIT_MINT_CONTRACT)

    const operator = randomAddress()
    const precondition = new Erc20ApprovalPrecondition(
      testWalletAddress,
      ERC20_IMPLICIT_MINT_CONTRACT,
      operator,
      1000000n, // 1 token min approval
    )

    const intentPrecondition = {
      type: precondition.type(),
      chainId: chainId.toString(),
      data: JSON.stringify({
        address: precondition.address.toString(),
        token: precondition.token.toString(),
        operator: precondition.operator.toString(),
        min: precondition.min.toString(),
      }),
    }

    if (!CAN_RUN_LIVE) {
      // Mock the allowance call
      ;(provider as any).call.mockResolvedValue('0x1e8480') // 1.5 tokens in hex
    }

    const isValid = await relayer.checkPrecondition(intentPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC721 ownership precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider as any)
    await requireContractDeployed(provider, ERC20_IMPLICIT_MINT_CONTRACT)

    const precondition = new Erc721OwnershipPrecondition(
      testWalletAddress,
      ERC20_IMPLICIT_MINT_CONTRACT,
      1n, // tokenId
      true, // must own
    )

    const intentPrecondition = {
      type: precondition.type(),
      chainId: chainId.toString(),
      data: JSON.stringify({
        address: precondition.address.toString(),
        token: precondition.token.toString(),
        tokenId: precondition.tokenId.toString(),
        owned: precondition.owned,
      }),
    }

    if (!CAN_RUN_LIVE) {
      // Mock the ownerOf call
      ;(provider as any).call.mockResolvedValue(
        '0x000000000000000000000000' + testWalletAddress.toString().slice(2).toLowerCase(),
      )
    }

    const isValid = await relayer.checkPrecondition(intentPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC721 approval precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider as any)
    await requireContractDeployed(provider, ERC20_IMPLICIT_MINT_CONTRACT)

    const operator = randomAddress()
    const precondition = new Erc721ApprovalPrecondition(
      testWalletAddress,
      ERC20_IMPLICIT_MINT_CONTRACT,
      1n, // tokenId
      operator,
    )

    const intentPrecondition = {
      type: precondition.type(),
      chainId: chainId.toString(),
      data: JSON.stringify({
        address: precondition.address.toString(),
        token: precondition.token.toString(),
        tokenId: precondition.tokenId.toString(),
        operator: precondition.operator.toString(),
      }),
    }

    if (!CAN_RUN_LIVE) {
      // Mock the getApproved call
      ;(provider as any).call.mockResolvedValue(
        '0x000000000000000000000000' + operator.toString().slice(2).toLowerCase(),
      )
    }

    const isValid = await relayer.checkPrecondition(intentPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC1155 balance precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider as any)
    await requireContractDeployed(provider, ERC20_IMPLICIT_MINT_CONTRACT)

    const precondition = new Erc1155BalancePrecondition(
      testWalletAddress,
      ERC20_IMPLICIT_MINT_CONTRACT,
      1n, // tokenId
      1000000n, // 1 token min
      2000000n, // 2 tokens max
    )

    const intentPrecondition = {
      type: precondition.type(),
      chainId: chainId.toString(),
      data: JSON.stringify({
        address: precondition.address.toString(),
        token: precondition.token.toString(),
        tokenId: precondition.tokenId.toString(),
        min: precondition.min?.toString(),
        max: precondition.max?.toString(),
      }),
    }

    if (!CAN_RUN_LIVE) {
      // Mock the balanceOf call
      ;(provider as any).call.mockResolvedValue('0x1e8480') // 1.5 tokens in hex
    }

    const isValid = await relayer.checkPrecondition(intentPrecondition)
    expect(isValid).toBe(true)
  })

  it('should create and check ERC1155 approval precondition', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider as any)
    await requireContractDeployed(provider, ERC20_IMPLICIT_MINT_CONTRACT)

    const operator = randomAddress()
    const precondition = new Erc1155ApprovalPrecondition(
      testWalletAddress,
      ERC20_IMPLICIT_MINT_CONTRACT,
      1n, // tokenId
      operator,
      1000000n, // 1 token min approval
    )

    const intentPrecondition = {
      type: precondition.type(),
      chainId: chainId.toString(),
      data: JSON.stringify({
        address: precondition.address.toString(),
        token: precondition.token.toString(),
        tokenId: precondition.tokenId.toString(),
        operator: precondition.operator.toString(),
        min: precondition.min.toString(),
      }),
    }

    if (!CAN_RUN_LIVE) {
      // Mock the isApprovedForAll call
      ;(provider as any).call.mockResolvedValue('0x1') // true
    }

    const isValid = await relayer.checkPrecondition(intentPrecondition)
    expect(isValid).toBe(true)
  })

  it('should wait for preconditions to be met before relaying transaction', async () => {
    const { provider, chainId } = await getProvider()
    const relayer = new LocalRelayer(provider as any)
    await requireContractDeployed(provider, ERC20_IMPLICIT_MINT_CONTRACT)

    // Create a precondition that initially fails
    const precondition = new Erc20BalancePrecondition(
      testWalletAddress,
      ERC20_IMPLICIT_MINT_CONTRACT,
      1000000n, // 1 token min
    )

    const intentPrecondition = {
      type: precondition.type(),
      chainId: chainId.toString(),
      data: JSON.stringify({
        address: precondition.address.toString(),
        token: precondition.token.toString(),
        min: precondition.min?.toString(),
      }),
    }

    // Mock initial balance check to fail
    let currentBalance = 0n
    if (!CAN_RUN_LIVE) {
      ;(provider as any).call.mockImplementation(() => {
        return Bytes.toHex(Bytes.fromNumber(currentBalance))
      })
    }

    // Create a test operation
    const payload: IntentCallsPayload = {
      chainId: 1n,
      type: 'call',
      space: 0n,
      nonce: 0n,
      calls: [
        {
          to: ERC20_IMPLICIT_MINT_CONTRACT,
          value: 0n,
          data: '0x' as Hex.Hex,
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'ignore',
        },
      ],
    }

    // Create context
    const context: Context.Context = {
      factory: randomAddress(),
      creationCode: '0x' as Hex.Hex,
      stage1: '0x' as Hex.Hex,
      stage2: '0x' as Hex.Hex,
    }

    // Calculate intent configuration address
    const configAddress = calculateIntentConfigurationAddress(testWalletAddress, [payload], context)

    // Start the relay operation with a short check interval
    const relayPromise = relayer.relay(
      configAddress,
      Bytes.toHex(
        Payload.encode(
          Payload.fromCall(0n, 0n, [
            {
              to: ERC20_IMPLICIT_MINT_CONTRACT,
              value: 0n,
              data: '0x' as Hex.Hex,
              gasLimit: 0n,
              delegateCall: false,
              onlyFallback: false,
              behaviorOnError: 'ignore',
            },
          ]),
        ),
      ),
      chainId,
      undefined,
      [intentPrecondition],
      100, // Short check interval for testing
    )

    // Simulate ERC20 transfer by updating the mock balance
    if (!CAN_RUN_LIVE) {
      currentBalance = 1500000n // Transfer 1.5 tokens
    } else {
      // In live mode, we would need to actually transfer tokens here
      const transferAmount = 1500000n
      const erc20Transfer = AbiFunction.from('function transfer(address,uint256) returns (bool)')
      const transferData = AbiFunction.encodeData(erc20Transfer, [
        testWalletAddress.toString() as Hex.Hex,
        transferAmount,
      ]) as Hex.Hex
      await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            to: ERC20_IMPLICIT_MINT_CONTRACT,
            data: transferData,
          },
        ],
      })
    }

    // Wait for the relay to complete
    const { opHash } = await relayPromise

    expect(opHash).toBeDefined()
    expect(opHash).not.toBe('0x')

    // Verify the transaction was sent
    if (!CAN_RUN_LIVE) {
      expect((provider as any).sendTransaction).toHaveBeenCalledWith({
        to: configAddress,
        data: Bytes.toHex(
          Payload.encode(
            Payload.fromCall(0n, 0n, [
              {
                to: ERC20_IMPLICIT_MINT_CONTRACT,
                value: 0n,
                data: '0x' as Hex.Hex,
                gasLimit: 0n,
                delegateCall: false,
                onlyFallback: false,
                behaviorOnError: 'ignore',
              },
            ]),
          ),
        ),
      })
    }
  })

  if (CAN_RUN_LIVE) {
    it('should create intent configuration with preconditions', async () => {
      const { provider, chainId } = await getProvider()
      const relayer = new LocalRelayer(provider as any)
      await requireContractDeployed(provider, ERC20_IMPLICIT_MINT_CONTRACT)

      // Create a test operation
      const payload: IntentCallsPayload = {
        chainId: 1n,
        type: 'call',
        space: 0n,
        nonce: 0n,
        calls: [
          {
            to: ERC20_IMPLICIT_MINT_CONTRACT,
            value: 0n,
            data: '0x' as Hex.Hex,
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'ignore',
          },
        ],
      }

      // Create preconditions
      const nativePrecondition = new NativeBalancePrecondition(
        testWalletAddress,
        1000000000000000000n, // 1 ETH min
      )

      const erc20Precondition = new Erc20BalancePrecondition(
        testWalletAddress,
        ERC20_IMPLICIT_MINT_CONTRACT,
        1000000n, // 1 token min
      )

      const intentPreconditions = [
        {
          type: nativePrecondition.type(),
          chainId: chainId.toString(),
          data: JSON.stringify({
            address: nativePrecondition.address.toString(),
            min: nativePrecondition.min?.toString(),
          }),
        },
        {
          type: erc20Precondition.type(),
          chainId: chainId.toString(),
          data: JSON.stringify({
            address: erc20Precondition.address.toString(),
            token: erc20Precondition.token.toString(),
            min: erc20Precondition.min?.toString(),
          }),
        },
      ]

      // Create context
      const context: Context.Context = {
        factory: randomAddress(),
        creationCode: Bytes.toHex(Bytes.fromHex('0x')) as Hex.Hex,
        stage1: Bytes.toHex(Bytes.fromHex('0x')) as Hex.Hex,
        stage2: Bytes.toHex(Bytes.fromHex('0x')) as Hex.Hex,
      }

      // Calculate intent configuration address
      const configAddress = calculateIntentConfigurationAddress(testWalletAddress, [payload], context)

      expect(configAddress).toBeDefined()
      expect(configAddress).not.toBe(testWalletAddress)

      // Check preconditions
      for (const precondition of intentPreconditions) {
        const isValid = await relayer.checkPrecondition(precondition)
        expect(isValid).toBe(true)
      }
    })

    it('should relay transaction when preconditions are met', async () => {
      const { provider, chainId } = await getProvider()
      const relayer = new LocalRelayer(provider as any)
      await requireContractDeployed(provider, ERC20_IMPLICIT_MINT_CONTRACT)

      // Create preconditions
      const nativePrecondition = new NativeBalancePrecondition(
        testWalletAddress,
        1000000000000000000n, // 1 ETH min
      )

      const erc20Precondition = new Erc20BalancePrecondition(
        testWalletAddress,
        ERC20_IMPLICIT_MINT_CONTRACT,
        1000000n, // 1 token min
      )

      const intentPreconditions = [
        {
          type: nativePrecondition.type(),
          chainId: chainId.toString(),
          data: JSON.stringify({
            address: nativePrecondition.address.toString(),
            min: nativePrecondition.min?.toString(),
          }),
        },
        {
          type: erc20Precondition.type(),
          chainId: chainId.toString(),
          data: JSON.stringify({
            address: erc20Precondition.address.toString(),
            token: erc20Precondition.token.toString(),
            min: erc20Precondition.min?.toString(),
          }),
        },
      ]

      // Create a test operation
      const payload: IntentCallsPayload = {
        chainId: 1n,
        type: 'call',
        space: 0n,
        nonce: 0n,
        calls: [
          {
            to: ERC20_IMPLICIT_MINT_CONTRACT,
            value: 0n,
            data: '0x' as Hex.Hex,
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'ignore',
          },
        ],
      }

      // Create context
      const context: Context.Context = {
        factory: randomAddress(),
        creationCode: Bytes.toHex(Bytes.fromHex('0x')) as Hex.Hex,
        stage1: Bytes.toHex(Bytes.fromHex('0x')) as Hex.Hex,
        stage2: Bytes.toHex(Bytes.fromHex('0x')) as Hex.Hex,
      }

      // Calculate intent configuration address
      const configAddress = calculateIntentConfigurationAddress(testWalletAddress, [payload], context)

      // Mock the provider responses
      if (!CAN_RUN_LIVE) {
        // Mock native balance check
        ;(provider as any).getBalance.mockResolvedValue(1500000000000000000n) // 1.5 ETH
        // Mock ERC20 balance check
        ;(provider as any).call.mockResolvedValue('0x1e8480') // 1.5 tokens
      }

      // Relay transaction with preconditions
      const { opHash } = await relayer.relay(
        configAddress,
        Bytes.toHex(Bytes.fromHex('0x')),
        chainId,
        undefined, // fee quote
        intentPreconditions,
        1000, // check interval in ms
      )

      expect(opHash).toBeDefined()
      expect(opHash).not.toBe('0x')

      // Verify the transaction was sent
      if (!CAN_RUN_LIVE) {
        expect((provider as any).sendTransaction).toHaveBeenCalledWith({
          to: configAddress,
          data: '0x' as Hex.Hex,
        })
      }
    })
  }
})

describe('Intent Configuration Address', () => {
  it('should calculate address for single operation', () => {
    // Create context matching Go test
    const context: Context.Context = {
      factory: Address.from('0x0000000000000000000000000000000000000000'),
      stage1: '0x0000000000000000000000000000000000000000' as Hex.Hex,
      stage2: '0x0000000000000000000000000000000000000000' as Hex.Hex,
      creationCode:
        '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3' as Hex.Hex,
    }

    // Main signer matching Go test
    const mainSigner = Address.from('0x1111111111111111111111111111111111111111')

    // Create a single operation matching Go test
    const payload: IntentCallsPayload = {
      chainId: 1n,
      type: 'call',
      space: 0n,
      nonce: 0n,
      calls: [
        {
          to: Address.from('0x0000000000000000000000000000000000000000'),
          value: 0n,
          data: '0x1234' as Hex.Hex,
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert',
        },
      ],
    }

    // Calculate intent configuration address
    const address = calculateIntentConfigurationAddress(mainSigner, [payload], context)

    // Verify the address matches Go test
    expect(isAddressEqual(address, '0x8577dFb93fE58cc8EE90DEA522555Fdf01Fd7429')).toBe(true)
  })

  it('should calculate address for multiple operations', () => {
    // Create context matching Go test
    const context: Context.Context = {
      factory: Address.from('0x0000000000000000000000000000000000000000'),
      stage1: '0x0000000000000000000000000000000000000000' as Hex.Hex,
      stage2: '0x0000000000000000000000000000000000000000' as Hex.Hex,
      creationCode:
        '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3' as Hex.Hex,
    }

    // Main signer matching Go test
    const mainSigner = Address.from('0x1111111111111111111111111111111111111111')

    // Create multiple operations matching Go test
    const payload1: IntentCallsPayload = {
      chainId: 1n,
      type: 'call',
      space: 0n,
      nonce: 0n,
      calls: [
        {
          to: Address.from('0x0000000000000000000000000000000000000000'),
          value: 0n,
          data: '0x1234' as Hex.Hex,
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert',
        },
      ],
    }

    const payload2: IntentCallsPayload = {
      chainId: 1n,
      type: 'call',
      space: 0n,
      nonce: 0n,
      calls: [
        {
          to: Address.from('0x0000000000000000000000000000000000000000'),
          value: 0n,
          data: '0x5678' as Hex.Hex,
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert',
        },
      ],
    }

    // Calculate intent configuration address
    const address = calculateIntentConfigurationAddress(mainSigner, [payload1, payload2], context)

    // Verify the address matches Go test
    expect(isAddressEqual(address, '0xBd820eD5b1E969eD6509E8EdE687DfC4c714438F')).toBe(true)
  })

  it('should calculate address for multi-chain intent operations', () => {
    // Create context
    const context: Context.Context = {
      factory: '0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447' as `0x${string}`,
      stage1: '0x2440595Ead70Ba5874572153910362DcA2dde417' as `0x${string}`,
      stage2: '0xa3F27508a1Dac8A11C0791f7EBEA5fc95dC1e131' as `0x${string}`,
      creationCode:
        '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3' as `0x${string}`,
    }

    // Main signer
    const mainSigner = Address.from('0x1111111111111111111111111111111111111111')

    // Create multi-chain operations
    const arbitrumPayload: IntentCallsPayload = {
      chainId: 42161n,
      type: 'call',
      space: 0n,
      nonce: 0n,
      calls: [
        {
          to: Address.from('0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae'),
          value: 16960774n,
          data: '0xa6010a66000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000002200000000000000000000000000000000000000000000000000000000000000be0548f317223fcd2c44d34d7e8ec9fc78482cd1d61cd3d3f206ad07ed50d043c02000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000008456195dd0793c621c7f9245edf0fef85b1b879c00000000000000000000000000000000000000000000000000000000000072c0000000000000000000000000000000000000000000000000000000000000210500000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d737461726761746556324275730000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000086c6966692d617069000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000006352a56caadc4f1e25cd6c75970fa768a3304e640000000000000000000000006352a56caadc4f1e25cd6c75970fa768a3304e640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000000000000000000000000000000000f2388207e4600000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000086490411a32000000000000000000000000f851d3d46237ec552a4c6e383a973115e781b1a5000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000f851d3d46237ec552a4c6e383a973115e781b1a50000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000f2388207e46000000000000000000000000000000000000000000000000000000000000753200000000000000000000000000000000000000000000000000000000000078d20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000933a06c631ed8b5e4f3848c91a1cfc45e5c7eab3000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000042000000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f2388207e4600000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000004d0e30db00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000104e5b07cdb0000000000000000000000001276ca67566283cce1cffe830e0bb873c80551be000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000f2388207e46000000000000000000000000f851d3d46237ec552a4c6e383a973115e781b1a500000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000002e82af49447d8a07e3bd95bd0d56f35241523fbab1000bb8af88d065e77c8cc2239327c5edb3a432268e583100001f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000648a6a1e85000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000922164bbbd36acf9e854acbbf32facc949fcaeef00000000000000000000000000000000000000000000000000000000000078d200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001a49f865422000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000100000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000064d1660f99000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000077368def90800000000000000000000000000000000000000000000000000000000000000000000000000000000000000008456195dd0793c621c7f9245edf0fef85b1b879c00000000000000000000000000000000000000000000000000000000000075e80000000000000000000000008456195dd0793c621c7f9245edf0fef85b1b879c0000000000000000000000000000000000000000000000000000000000007532000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000' as Hex.Hex,
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'ignore',
        },
      ],
    }

    const basePayload: IntentCallsPayload = {
      chainId: 8453n,
      type: 'call',
      space: 0n,
      nonce: 0n,
      calls: [
        {
          to: Address.from('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'),
          value: 0n,
          data: '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000000000000007530' as Hex.Hex,
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'ignore',
        },
      ],
    }

    // Calculate intent configuration address
    const address = calculateIntentConfigurationAddress(mainSigner, [arbitrumPayload, basePayload], context)

    // The address should be deterministic based on the inputs
    expect(address).toBeDefined()
    expect(address.startsWith('0x')).toBe(true)
    expect(address.length).toBe(42)

    console.log('address', address)

    // Calculated address should match Go test
    expect(isAddressEqual(address, '0xB2621385fae972FEF53985ed7B9673EacD5a32Ff')).toBe(true)
  })
})
