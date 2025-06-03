import { Address, Bytes, Provider, Hex, RpcTransport, Secp256k1, AbiFunction, AbiParameters, Hash } from 'ox'
import { Context, Payload } from '@0xsequence/wallet-primitives'
import { Relayer } from '@0xsequence/wallet-core'
import { describe, it, expect, vi } from 'vitest'
import { isAddressEqual } from 'viem'
import { Preconditions } from '@0xsequence/wallet-core'
import {
  calculateIntentConfigurationAddress,
  hashIntentParams,
  IntentCallsPayload,
  AnypayLifiInfo,
  getAnypayLifiInfoHash,
} from '../src/intents.js'
import 'dotenv/config'

const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || 'http://localhost:8545'
const { RPC_URL, PRIVATE_KEY } = process.env
const CAN_RUN_LIVE = !!RPC_URL && !!PRIVATE_KEY

const LocalRelayer = Relayer.Local.LocalRelayer
const {
  NativeBalancePrecondition,
  Erc20BalancePrecondition,
  Erc20ApprovalPrecondition,
  Erc721OwnershipPrecondition,
  Erc721ApprovalPrecondition,
  Erc1155BalancePrecondition,
  Erc1155ApprovalPrecondition,
} = Preconditions

const ERC20_IMPLICIT_MINT_CONTRACT = '0x041E0CDC028050519C8e6485B2d9840caf63773F'

function randomAddress(): Address.Address {
  return Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: Secp256k1.randomPrivateKey() }))
}

describe('AnyPay Preconditions', () => {
  const getProvider = async (): Promise<{ provider: Provider.Provider; chainId: bigint }> => {
    let provider: Provider.Provider
    let chainId = 1n
    if (CAN_RUN_LIVE) {
      provider = Provider.from(RpcTransport.fromHttp(RPC_URL!))
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
      expect((provider as any).sendTransaction).toHaveBeenCalledWith(
        {
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
        },
        1n,
      )
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

describe('Intent Configuration Address with LifiInfo', () => {
  const testContext: Context.Context = {
    factory: Address.from('0x0000000000000000000000000000000000000000'),
    stage1: '0x0000000000000000000000000000000000000000' as Hex.Hex, // MainModuleAddress
    stage2: '0x0000000000000000000000000000000000000000' as Hex.Hex, // guestModule
    creationCode:
      '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3' as Hex.Hex,
  }

  const mainSigner = Address.from('0x1111111111111111111111111111111111111111')
  const attestationSigner = Address.from('0x0000000000000000000000000000000000000001')

  const lifiInfos: AnypayLifiInfo[] = [
    {
      originToken: Address.from('0x1111111111111111111111111111111111111111'),
      amount: 100n,
      originChainId: 1n,
      destinationChainId: 10n,
    },
  ]

  it('should calculate address for single operation with lifiInfo', () => {
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
          behaviorOnError: 'revert' as const,
        },
      ],
    }

    const address = calculateIntentConfigurationAddress(
      mainSigner,
      [payload],
      testContext,
      attestationSigner,
      lifiInfos,
    )

    console.log('Single Operation with LifiInfo Test Address:', address)
    expect(isAddressEqual(address, '0x820B2237906fEEBdB45a6Be43d33137253Eeeac5')).toBe(true)
  })

  it('should calculate address for multiple operations with lifiInfo', () => {
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
          behaviorOnError: 'revert' as const,
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
          behaviorOnError: 'revert' as const,
        },
      ],
    }

    const address = calculateIntentConfigurationAddress(
      mainSigner,
      [payload1, payload2],
      testContext,
      attestationSigner,
      lifiInfos,
    )

    console.log('Multiple Operations with LifiInfo Test Address:', address)
    expect(isAddressEqual(address, '0x807f90d703db799F810a43DBcf81B09d7053e8e6')).toBe(true)
  })
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
          data: Bytes.toHex(Bytes.fromString('data1')) as Hex.Hex,
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'ignore' as const,
        },
      ],
    }

    // Calculate intent configuration address
    const address = calculateIntentConfigurationAddress(mainSigner, [payload], context)

    console.log('address', address)

    // Verify the address matches Go test
    expect(isAddressEqual(address, '0x95b51097940ed0f7ed5758bbd828b48e7891ec94')).toBe(true)
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
          data: Bytes.toHex(Bytes.fromString('data1')) as Hex.Hex,
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'ignore' as const,
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
          data: Bytes.toHex(Bytes.fromString('data2')) as Hex.Hex,
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'ignore' as const,
        },
      ],
    }

    // Calculate intent configuration address
    const address = calculateIntentConfigurationAddress(mainSigner, [payload1, payload2], context)

    console.log('address', address)

    // Verify the address matches Go test
    expect(isAddressEqual(address, '0xdb59510c80765bcc1b70e36b2583786ecb990476')).toBe(true)
  })

  it('should calculate address for multi-chain intent operations', () => {
    // Create context
    const context: Context.Context = {
      factory: '0xBd0F8abD58B4449B39C57Ac9D5C67433239aC447' as `0x${string}`,
      stage1: '0x53bA242E7C2501839DF2972c75075dc693176Cd0' as `0x${string}`,
      stage2: '0xa29874c88b8Fd557e42219B04b0CeC693e1712f5' as `0x${string}`,
      creationCode:
        '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3' as `0x${string}`,
    }

    // Main signer
    const mainSigner = Address.from('0x8456195dd0793c621c7f9245edF0fEf85b1B879C')

    // Create multi-chain operations
    const arbitrumPayload: IntentCallsPayload = {
      chainId: 42161n,
      type: 'call',
      space: 0n,
      nonce: 0n,
      calls: [
        {
          to: Address.from('0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae'),
          value: 16618237n,
          data: '0xa6010a660000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000005801784da62343d604885e1181a759647447f13330cc2b8c925cda864b1ac1ce8fc000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000008456195dd0793c621c7f9245edf0fef85b1b879c00000000000000000000000000000000000000000000000000000000000073ac000000000000000000000000000000000000000000000000000000000000210500000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d737461726761746556324275730000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000086c6966692d61706900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000111111125421ca6dc452d289314280a0f8842a65000000000000000000000000111111125421ca6dc452d289314280a0f8842a650000000000000000000000000000000000000000000000000000000000000000000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000000000000000000000000000000000f42af44fef500000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000020807ed2379000000000000000000000000de9e4fe32b049f821c7f3e9802381aa470ffca73000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000de9e4fe32b049f821c7f3e9802381aa470ffca730000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000f42af44fef500000000000000000000000000000000000000000000000000000000000075320000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000ba00000000000000000000000000000000000000000000000000000000009c4160de632c3a214d5f14c1d8ddf0b92f8bcd188fee4500242668dfaa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007532000000000000000000000000111111125421ca6dc452d289314280a0f8842a650000000000002a94d114000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000077368def90800000000000000000000000000000000000000000000000000000000000000000000000000000000000000008456195dd0793c621c7f9245edf0fef85b1b879c00000000000000000000000000000000000000000000000000000000000075e80000000000000000000000008456195dd0793c621c7f9245edf0fef85b1b879c0000000000000000000000000000000000000000000000000000000000007532000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000' as Hex.Hex,
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'ignore' as const,
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
          behaviorOnError: 'ignore' as const,
        },
      ],
    }

    // Calculate intent configuration address
    const address = calculateIntentConfigurationAddress(mainSigner, [arbitrumPayload, basePayload], context)

    // Log the address
    console.log('address', address)

    // Verify the address matches the expected value
    expect(isAddressEqual(address, '0x5bd7f0269f4aa805f5a13b3104d596c151d8ec76')).toBe(true)
  })
})

describe('HashIntentParams', () => {
  it('should error on empty fields', () => {
    expect(() =>
      hashIntentParams({
        userAddress: Address.from('0x0000000000000000000000000000000000000000'),
        nonce: 0n,
        originTokens: [],
        destinationCalls: [],
        destinationTokens: [],
      }),
    ).toThrow()
  })

  it('should match hash for single call', () => {
    const call = {
      to: Address.from('0x1111111111111111111111111111111111111111'),
      value: 123n,
      data: Bytes.toHex(Bytes.fromString('data1')) as Hex.Hex,
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'ignore' as const,
    }
    const payload: IntentCallsPayload = {
      chainId: 1n,
      type: 'call',
      space: 0n,
      nonce: 0n,
      calls: [call],
    }
    const params = {
      userAddress: Address.from('0x3333333333333333333333333333333333333333'),
      nonce: 0n,
      originTokens: [{ address: Address.from('0x4444444444444444444444444444444444444444'), chainId: 1n }],
      destinationCalls: [payload],
      destinationTokens: [
        {
          address: Address.from('0x4444444444444444444444444444444444444444'),
          chainId: 1n,
          amount: 123n,
        },
      ],
    }
    const hash = hashIntentParams(params)

    expect(hash.toLowerCase()).toBe('0x4479e1ed63b1cf70ed13228bec79f2a1d2ffa0e9372e2afc7d82263cd8107451')
  })

  it('should match hash for multiple calls', () => {
    const call1 = {
      to: Address.from('0x1111111111111111111111111111111111111111'),
      value: 123n,
      data: Bytes.toHex(Bytes.fromString('data1')) as Hex.Hex,
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'ignore' as const,
    }
    const call2 = {
      to: Address.from('0x5555555555555555555555555555555555555555'),
      value: 456n,
      data: Bytes.toHex(Bytes.fromString('data2')) as Hex.Hex,
      gasLimit: 0n,
      delegateCall: false,
      onlyFallback: false,
      behaviorOnError: 'ignore' as const,
    }
    const payload1: IntentCallsPayload = {
      chainId: 1n,
      type: 'call',
      space: 0n,
      nonce: 0n,
      calls: [call1],
    }
    const payload2: IntentCallsPayload = {
      chainId: 1n,
      type: 'call',
      space: 0n,
      nonce: 0n,
      calls: [call2],
    }
    const params = {
      userAddress: Address.from('0x3333333333333333333333333333333333333333'),
      nonce: 0n,
      originTokens: [{ address: Address.from('0x4444444444444444444444444444444444444444'), chainId: 1n }],
      destinationCalls: [payload1, payload2],
      destinationTokens: [
        {
          address: Address.from('0x4444444444444444444444444444444444444444'),
          chainId: 1n,
          amount: 123n,
        },
      ],
    }
    const hash = hashIntentParams(params)
    expect(hash.toLowerCase()).toBe('0x64631a48bc218cd8196dca22437223d90dc9caa8208284cdcea4b7f32bfc7cec')
  })
})

describe('GetAnypayLifiInfoHash', () => {
  it('should match hash for single AnypayLifiInfo', () => {
    const lifiInfos: AnypayLifiInfo[] = [
      {
        originToken: Address.from('0x1111111111111111111111111111111111111111'),
        amount: 100n,
        originChainId: 1n,
        destinationChainId: 10n,
      },
    ]
    const attestationAddress = Address.from('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa')

    const hash = getAnypayLifiInfoHash(lifiInfos, attestationAddress)
    expect(hash.toLowerCase()).toBe('0x21872bd6b64711c4a5aecba95829c612f0b50c63f1a26991c2f76cf4a754aede')
  })

  it('should match hash for multiple AnypayLifiInfo', () => {
    const lifiInfos: AnypayLifiInfo[] = [
      {
        originToken: Address.from('0x1111111111111111111111111111111111111111'),
        amount: 100n,
        originChainId: 1n,
        destinationChainId: 10n,
      },
      {
        originToken: Address.from('0x2222222222222222222222222222222222222222'),
        amount: 200n,
        originChainId: 137n,
        destinationChainId: 42161n,
      },
    ]
    const attestationAddress = Address.from('0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB')

    const hash = getAnypayLifiInfoHash(lifiInfos, attestationAddress)
    expect(hash.toLowerCase()).toBe('0xd18e54455db64ba31b9f9a447e181f83977cb70b136228d64ac85d64a6aefe71')
  })

  it('should error on empty lifiInfos', () => {
    const attestationAddress = Address.from('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa')
    expect(() => getAnypayLifiInfoHash([], attestationAddress)).toThrow('lifiInfos is empty')
  })

  it('should error on zero attestationAddress', () => {
    const lifiInfos: AnypayLifiInfo[] = [
      {
        originToken: Address.from('0x1111111111111111111111111111111111111111'),
        amount: 100n,
        originChainId: 1n,
        destinationChainId: 10n,
      },
    ]
    const attestationAddress = Address.from('0x0000000000000000000000000000000000000000')
    expect(() => getAnypayLifiInfoHash(lifiInfos, attestationAddress)).toThrow('attestationAddress is zero')
  })
})
