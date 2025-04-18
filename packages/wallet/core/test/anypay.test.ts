import { Address, Bytes, Provider, RpcTransport, Secp256k1, AbiFunction } from 'ox'
import { Context, Payload } from '@0xsequence/wallet-primitives'
import { LocalRelayer } from '../src/relayer/local'
import {
  NativeBalancePrecondition,
  Erc20BalancePrecondition,
  Erc20ApprovalPrecondition,
  Erc721OwnershipPrecondition,
  Erc721ApprovalPrecondition,
  Erc1155BalancePrecondition,
  Erc1155ApprovalPrecondition,
} from '../src/preconditions/types'
import { CAN_RUN_LIVE, ERC20_IMPLICIT_MINT_CONTRACT, RPC_URL } from './constants'
import { calculateIntentConfigurationAddress, IntentOperation } from '../src/anypay/intents'

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
        request: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
        sendTransaction: jest.fn(),
        getBalance: jest.fn(),
        call: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks()
  })

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
    const operation: IntentOperation = {
      chainId,
      calls: [
        {
          to: ERC20_IMPLICIT_MINT_CONTRACT,
          value: 0n,
          data: Bytes.fromHex('0x'),
          gasLimit: 0n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 0n, // 0 = ignore, 1 = revert, 2 = abort
        },
      ],
    }

    // Create context
    const context: Context.Context = {
      factory: randomAddress(),
      creationCode: '0x' as `0x${string}`,
      stage1: '0x' as `0x${string}`,
    }

    // Calculate intent configuration address
    const configAddress = calculateIntentConfigurationAddress([operation], testIdentityAddress, context)

    // Start the relay operation with a short check interval
    const relayPromise = relayer.relay(
      configAddress,
      Bytes.toHex(
        Payload.encode(
          Payload.fromCall(0n, 0n, [
            {
              to: ERC20_IMPLICIT_MINT_CONTRACT,
              value: 0n,
              data: Bytes.fromHex('0x'),
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
        testWalletAddress.toString() as `0x${string}`,
        transferAmount,
      ]) as `0x${string}`
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
                data: Bytes.fromHex('0x'),
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
      const operation: IntentOperation = {
        chainId,
        calls: [
          {
            to: ERC20_IMPLICIT_MINT_CONTRACT,
            value: 0n,
            data: Bytes.fromHex('0x'),
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 0n,
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
          data: JSON.stringify({
            address: nativePrecondition.address.toString(),
            min: nativePrecondition.min?.toString(),
          }),
        },
        {
          type: erc20Precondition.type(),
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
        creationCode: Bytes.toHex(Bytes.fromHex('0x')) as `0x${string}`,
        stage1: Bytes.toHex(Bytes.fromHex('0x')) as `0x${string}`,
      }

      // Calculate intent configuration address
      const configAddress = calculateIntentConfigurationAddress([operation], testIdentityAddress, context)

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
          data: JSON.stringify({
            address: nativePrecondition.address.toString(),
            min: nativePrecondition.min?.toString(),
          }),
        },
        {
          type: erc20Precondition.type(),
          data: JSON.stringify({
            address: erc20Precondition.address.toString(),
            token: erc20Precondition.token.toString(),
            min: erc20Precondition.min?.toString(),
          }),
        },
      ]

      // Create a test operation
      const operation: IntentOperation = {
        chainId,
        calls: [
          {
            to: ERC20_IMPLICIT_MINT_CONTRACT,
            value: 0n,
            data: Bytes.fromHex('0x'),
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 0n,
          },
        ],
      }

      // Create context
      const context: Context.Context = {
        factory: randomAddress(),
        creationCode: Bytes.toHex(Bytes.fromHex('0x')) as `0x${string}`,
        stage1: Bytes.toHex(Bytes.fromHex('0x')) as `0x${string}`,
      }

      // Calculate intent configuration address
      const configAddress = calculateIntentConfigurationAddress([operation], testIdentityAddress, context)

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
          data: '0x',
        })
      }
    })
  }
})
