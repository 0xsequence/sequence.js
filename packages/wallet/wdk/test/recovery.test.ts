import { describe, expect, it } from 'vitest'
import { Manager, QueuedRecoveryPayload, SignerReady, TransactionDefined } from '../src/sequence'
import { Bytes, Hex, Mnemonic, Provider, RpcTransport } from 'ox'
import { Network, Payload } from '@0xsequence/wallet-primitives'
import { LOCAL_RPC_URL, newManager } from './constants'

describe('Recovery', () => {
  it('Should execute a recovery', async () => {
    const manager = newManager({
      defaultRecoverySettings: {
        requiredDeltaTime: 2n, // 2 seconds
        minTimestamp: 0n,
      },
    })

    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    // Add recovery mnemonic
    const mnemonic2 = Mnemonic.random(Mnemonic.english)
    const requestId1 = await manager.recovery.addMnemonic(wallet!, mnemonic2)

    expect(requestId1).toBeDefined()

    // Sign add recovery mnemonic
    const request1 = await manager.signatures.get(requestId1)
    expect(request1).toBeDefined()

    // Device must be the only ready signer now
    const device = request1.signers.find((s) => s.status === 'ready')
    expect(device).toBeDefined()

    const result1 = await device?.handle()
    expect(result1).toBeDefined()
    expect(result1).toBeTruthy()

    // Complete the add of the recovery mnemonic
    await manager.recovery.completeUpdate(requestId1)

    // Get the recovery signers, there should be two one
    // and one should not be the device address
    const recoverySigners = await manager.recovery.getSigners(wallet!)
    expect(recoverySigners).toBeDefined()
    expect(recoverySigners!.length).toBe(2)
    const nonDeviceSigner = recoverySigners!.find((s) => s.address !== device?.address)
    expect(nonDeviceSigner).toBeDefined()

    // Transfer 1 wei to the wallet
    const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
    const [relayerFrom] = (await provider.request({ method: 'eth_accounts', params: [] as any })) as `0x${string}`[]
    await provider.request({
      method: 'anvil_setBalance',
      params: [wallet!, '0x3635c9adc5dea0000'], // 0.1 ETH
    })

    // Create a new recovery payload
    const requestId2 = await manager.recovery.queuePayload(wallet!, Network.ChainId.ARBITRUM, {
      type: 'call',
      space: Bytes.toBigInt(Bytes.random(20)),
      nonce: 0n,
      calls: [
        {
          to: Hex.from(Bytes.random(20)),
          value: 1n,
          data: '0x',
          gasLimit: 1000000n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert',
        },
      ],
    })

    // Needs to be signed using the recovery mnemonic
    // for this we need to define a handler for it
    let handledMnemonic2 = 0
    const unregisterHandler = manager.registerMnemonicUI(async (respond) => {
      handledMnemonic2++
      await respond(mnemonic2)
    })

    // Sign the queue recovery payload
    const request2 = await manager.signatures.get(requestId2)
    expect(request2).toBeDefined()

    // Complete the queue recovery payload
    // the only signer available should be the device and the recovery mnemonic
    // the both recovery deviecs that we have
    expect(request2.signers.length).toBe(2)
    expect(request2.signers.some((s) => s.handler?.kind === 'local-device')).toBeTruthy()
    expect(request2.signers.some((s) => s.handler?.kind === 'login-mnemonic')).toBeTruthy()

    // Handle the login-mnemonic signer
    const request2Signer = request2.signers.find((s) => s.handler?.kind === 'login-mnemonic')
    expect(request2Signer).toBeDefined()
    const result2 = await (request2Signer as SignerReady).handle()
    expect(result2).toBeDefined()
    expect(result2).toBeTruthy()
    expect(handledMnemonic2).toBe(1)
    unregisterHandler()

    // Complete the recovery payload
    const { to, data } = await manager.recovery.completePayload(requestId2)

    // Send this transaction to anvil so we queue the payload
    await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: relayerFrom,
          to,
          data,
        },
      ],
    })

    // Wait 3 seconds for the payload to become valid
    await new Promise((resolve) => setTimeout(resolve, 3000))
    await manager.recovery.updateQueuedPayloads()

    // Get the recovery payloads
    const recoveryPayloads = await new Promise<QueuedRecoveryPayload[]>((resolve) => {
      const unsubscribe = manager.recovery.onQueuedPayloadsUpdate(
        wallet!,
        (payloads) => {
          unsubscribe()
          resolve(payloads)
        },
        true,
      )
    })

    expect(recoveryPayloads).toBeDefined()
    expect(recoveryPayloads.length).toBe(1)
    const recoveryPayload = recoveryPayloads![0]
    expect(recoveryPayload).toBeDefined()
    expect(Payload.isCalls(recoveryPayload!.payload!)).toBeTruthy()
    expect((recoveryPayload!.payload as Payload.Calls).calls.length).toBe(1)

    // Send this transaction as any other regular transaction
    const requestId3 = await manager.transactions.request(
      wallet!,
      Network.ChainId.ARBITRUM,
      (recoveryPayload!.payload as Payload.Calls).calls,
      {
        noConfigUpdate: true,
      },
    )
    expect(requestId3).toBeDefined()

    // Define the same nonce and space for the recovery payload
    await manager.transactions.define(requestId3, {
      nonce: (recoveryPayload!.payload as Payload.Calls).nonce,
      space: (recoveryPayload!.payload as Payload.Calls).space,
    })

    // Complete the transaction
    const tx = await manager.transactions.get(requestId3)
    expect(tx).toBeDefined()
    expect(tx.status).toBe('defined')
    expect((tx as TransactionDefined).relayerOptions.length).toBe(1)

    const localRelayer = (tx as TransactionDefined).relayerOptions[0]
    expect(localRelayer).toBeDefined()
    expect(localRelayer.relayerId).toBe('local')

    // Define the relayer
    const requestId4 = await manager.transactions.selectRelayer(requestId3, localRelayer.id)
    expect(requestId4).toBeDefined()

    // Now we sign using the recovery module
    const request4 = await manager.signatures.get(requestId4)

    // Find the signer that is the recovery module handler
    const recoverySigner = request4.signers.find((s) => s.handler?.kind === 'recovery-extension')
    expect(recoverySigner).toBeDefined()
    expect(recoverySigner!.status).toBe('ready')
    1
    // Handle the recovery signer
    const result4 = await (recoverySigner as SignerReady).handle()
    expect(result4).toBeDefined()
    expect(result4).toBeTruthy()

    // Complete the transaction
    await manager.transactions.relay(requestId4)

    // The balance of the wallet should be 0 wei
    const balance = await provider.request({
      method: 'eth_getBalance',
      params: [wallet!, 'latest'],
    })
    expect(balance).toBeDefined()
    expect(balance).toBe('0x3635c9adc5de9ffff') // 0.1 ETH - 1 wei

    // Refresh the queued recovery payloads, the executed one
    // should be removed
    await manager.recovery.updateQueuedPayloads()
    const recoveryPayloads2 = await new Promise<QueuedRecoveryPayload[]>((resolve) => {
      const unsubscribe = manager.recovery.onQueuedPayloadsUpdate(
        wallet!,
        (payloads) => {
          unsubscribe()
          resolve(payloads)
        },
        true,
      )
    })
    expect(recoveryPayloads2).toBeDefined()
    expect(recoveryPayloads2.length).toBe(0)
  }, 30000)

  it('Should fetch queued payloads for wallet with no recovery signers', async () => {
    const manager = newManager()

    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    // Wallet has no recovery signers, should return empty array
    const payloads = await manager.recovery.fetchQueuedPayloads(wallet!)
    expect(payloads).toBeDefined()
    expect(Array.isArray(payloads)).toBeTruthy()
    expect(payloads.length).toBe(0)
  })

  it('Should fetch queued payloads for wallet with recovery signers but no queued payloads', async () => {
    const manager = newManager()

    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    // Add recovery mnemonic
    const mnemonic2 = Mnemonic.random(Mnemonic.english)
    const requestId = await manager.recovery.addMnemonic(wallet!, mnemonic2)

    // Sign and complete the recovery signer addition
    const request = await manager.signatures.get(requestId)
    const device = request.signers.find((s) => s.status === 'ready')
    expect(device).toBeDefined()

    await device?.handle()
    await manager.recovery.completeUpdate(requestId)

    // Verify recovery signers exist
    const recoverySigners = await manager.recovery.getSigners(wallet!)
    expect(recoverySigners).toBeDefined()
    expect(recoverySigners!.length).toBeGreaterThan(0)

    // Should return empty array since no payloads are queued
    const payloads = await manager.recovery.fetchQueuedPayloads(wallet!)
    expect(payloads).toBeDefined()
    expect(Array.isArray(payloads)).toBeTruthy()
    expect(payloads.length).toBe(0)
  })

  it('Should fetch queued payloads and match updateQueuedPayloads results', async () => {
    const manager = newManager({
      defaultRecoverySettings: {
        requiredDeltaTime: 2n, // 2 seconds
        minTimestamp: 0n,
      },
    })

    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    // Add recovery mnemonic
    const mnemonic2 = Mnemonic.random(Mnemonic.english)
    const requestId1 = await manager.recovery.addMnemonic(wallet!, mnemonic2)

    // Sign and complete the recovery signer addition
    const request1 = await manager.signatures.get(requestId1)
    const device = request1.signers.find((s) => s.status === 'ready')
    expect(device).toBeDefined()

    await device?.handle()
    await manager.recovery.completeUpdate(requestId1)

    // Transfer 1 wei to the wallet
    const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
    const [relayerFrom] = (await provider.request({ method: 'eth_accounts', params: [] as any })) as `0x${string}`[]
    await provider.request({
      method: 'anvil_setBalance',
      params: [wallet!, '0x1'],
    })

    // Create and queue a recovery payload
    const requestId2 = await manager.recovery.queuePayload(wallet!, Network.ChainId.ARBITRUM, {
      type: 'call',
      space: Bytes.toBigInt(Bytes.random(20)),
      nonce: 0n,
      calls: [
        {
          to: Hex.from(Bytes.random(20)),
          value: 1n,
          data: '0x',
          gasLimit: 1000000n,
          delegateCall: false,
          onlyFallback: false,
          behaviorOnError: 'revert',
        },
      ],
    })

    // Set up mnemonic handler and sign the payload
    let handledMnemonic2 = 0
    const unregisterHandler = manager.registerMnemonicUI(async (respond) => {
      handledMnemonic2++
      await respond(mnemonic2)
    })

    const request2 = await manager.signatures.get(requestId2)
    const request2Signer = request2.signers.find((s) => s.handler?.kind === 'login-mnemonic')
    expect(request2Signer).toBeDefined()

    await (request2Signer as SignerReady).handle()
    unregisterHandler()

    // Complete the recovery payload and send to blockchain
    const { to, data } = await manager.recovery.completePayload(requestId2)
    await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: relayerFrom, to, data }],
    })

    // Wait for payload to become valid
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Test fetchQueuedPayloads directly
    const fetchedPayloads = await manager.recovery.fetchQueuedPayloads(wallet!)
    expect(fetchedPayloads).toBeDefined()
    expect(Array.isArray(fetchedPayloads)).toBeTruthy()
    expect(fetchedPayloads.length).toBe(1)

    const fetchedPayload = fetchedPayloads[0]
    expect(fetchedPayload).toBeDefined()
    expect(fetchedPayload.wallet).toBe(wallet)
    expect(fetchedPayload.chainId).toBe(Network.ChainId.ARBITRUM)
    expect(fetchedPayload.index).toBe(0n)
    expect(fetchedPayload.payload).toBeDefined()
    expect(Payload.isCalls(fetchedPayload.payload!)).toBeTruthy()
    expect((fetchedPayload.payload as Payload.Calls).calls.length).toBe(1)

    // Verify that fetchQueuedPayloads doesn't affect the database
    // by checking current database state before and after
    const payloadsBefore = await new Promise<QueuedRecoveryPayload[]>((resolve) => {
      const unsubscribe = manager.recovery.onQueuedPayloadsUpdate(
        wallet!,
        (payloads) => {
          unsubscribe()
          resolve(payloads)
        },
        true,
      )
    })

    // Call fetchQueuedPayloads again
    const fetchedPayloads2 = await manager.recovery.fetchQueuedPayloads(wallet!)

    const payloadsAfter = await new Promise<QueuedRecoveryPayload[]>((resolve) => {
      const unsubscribe = manager.recovery.onQueuedPayloadsUpdate(
        wallet!,
        (payloads) => {
          unsubscribe()
          resolve(payloads)
        },
        true,
      )
    })

    // Database should be unchanged by fetchQueuedPayloads
    expect(payloadsBefore.length).toBe(payloadsAfter.length)

    // Now update the database with updateQueuedPayloads
    await manager.recovery.updateQueuedPayloads()

    const updatedPayloads = await new Promise<QueuedRecoveryPayload[]>((resolve) => {
      const unsubscribe = manager.recovery.onQueuedPayloadsUpdate(
        wallet!,
        (payloads) => {
          unsubscribe()
          resolve(payloads)
        },
        true,
      )
    })

    // Results should match between fetchQueuedPayloads and updateQueuedPayloads
    expect(updatedPayloads.length).toBe(fetchedPayloads.length)
    expect(updatedPayloads.length).toBe(fetchedPayloads2.length)

    if (updatedPayloads.length > 0 && fetchedPayloads.length > 0) {
      const updated = updatedPayloads[0]
      const fetched = fetchedPayloads[0]

      expect(updated.id).toBe(fetched.id)
      expect(updated.wallet).toBe(fetched.wallet)
      expect(updated.chainId).toBe(fetched.chainId)
      expect(updated.index).toBe(fetched.index)
      expect(updated.signer).toBe(fetched.signer)
      expect(updated.payloadHash).toBe(fetched.payloadHash)
      expect(updated.startTimestamp).toBe(fetched.startTimestamp)
      expect(updated.endTimestamp).toBe(fetched.endTimestamp)
    }
  }, 30000)

  it('Should handle multiple queued payloads for the same wallet', async () => {
    const manager = newManager({
      defaultRecoverySettings: {
        requiredDeltaTime: 1n, // 1 second
        minTimestamp: 0n,
      },
    })

    const mnemonic = Mnemonic.random(Mnemonic.english)
    const wallet = await manager.wallets.signUp({ mnemonic, kind: 'mnemonic', noGuard: true })
    expect(wallet).toBeDefined()

    // Add recovery mnemonic
    const mnemonic2 = Mnemonic.random(Mnemonic.english)
    const requestId1 = await manager.recovery.addMnemonic(wallet!, mnemonic2)

    // Sign and complete the recovery signer addition
    const request1 = await manager.signatures.get(requestId1)
    const device = request1.signers.find((s) => s.status === 'ready')
    await device?.handle()
    await manager.recovery.completeUpdate(requestId1)

    // Transfer some wei to the wallet
    const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
    const [relayerFrom] = (await provider.request({ method: 'eth_accounts', params: [] as any })) as `0x${string}`[]
    await provider.request({
      method: 'anvil_setBalance',
      params: [wallet!, '0x10'],
    })

    // Set up mnemonic handler
    const unregisterHandler = manager.registerMnemonicUI(async (respond) => {
      await respond(mnemonic2)
    })

    // Create and queue multiple recovery payloads sequentially to avoid transaction conflicts
    for (let i = 0; i < 3; i++) {
      const requestId = await manager.recovery.queuePayload(wallet!, Network.ChainId.ARBITRUM, {
        type: 'call',
        space: Bytes.toBigInt(Bytes.random(20)),
        nonce: BigInt(i),
        calls: [
          {
            to: Hex.from(Bytes.random(20)),
            value: 1n,
            data: '0x',
            gasLimit: 1000000n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ],
      })

      const request = await manager.signatures.get(requestId)
      const signer = request.signers.find((s) => s.handler?.kind === 'login-mnemonic')
      await (signer as SignerReady).handle()

      const { to, data } = await manager.recovery.completePayload(requestId)

      // Send transactions sequentially to avoid nonce conflicts
      await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: relayerFrom, to, data }],
      })

      // Small delay to ensure transaction ordering
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    unregisterHandler()

    // Wait for payloads to become valid
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Fetch all queued payloads
    const fetchedPayloads = await manager.recovery.fetchQueuedPayloads(wallet!)
    expect(fetchedPayloads).toBeDefined()
    expect(Array.isArray(fetchedPayloads)).toBeTruthy()
    expect(fetchedPayloads.length).toBe(3)

    // Verify each payload has unique properties
    const indices = new Set(fetchedPayloads.map((p) => p.index.toString()))
    const ids = new Set(fetchedPayloads.map((p) => p.id))
    const payloadHashes = new Set(fetchedPayloads.map((p) => p.payloadHash))

    expect(indices.size).toBe(3) // All different indices
    expect(ids.size).toBe(3) // All different IDs
    expect(payloadHashes.size).toBe(3) // All different payload hashes

    // All should have the same wallet and chainId
    fetchedPayloads.forEach((payload) => {
      expect(payload.wallet).toBe(wallet)
      expect(payload.chainId).toBe(Network.ChainId.ARBITRUM)
      expect(payload.payload).toBeDefined()
      expect(Payload.isCalls(payload.payload!)).toBeTruthy()
    })
  }, 30000)
})
