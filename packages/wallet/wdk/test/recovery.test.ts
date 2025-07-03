import { describe, expect, it } from 'vitest'
import { Manager, QueuedRecoveryPayload, SignerReady, TransactionDefined } from '../src/sequence'
import { Bytes, Hex, Mnemonic, Provider, RpcTransport } from 'ox'
import { Payload } from '@0xsequence/wallet-primitives'
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
    const requestId1 = await manager.addRecoveryMnemonic(wallet!, mnemonic2)

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
    await manager.completeRecoveryUpdate(requestId1)

    // Get the recovery signers, there should be two one
    // and one should not be the device address
    const recoverySigners = await manager.getRecoverySigners(wallet!)
    expect(recoverySigners).toBeDefined()
    expect(recoverySigners!.length).toBe(2)
    const nonDeviceSigner = recoverySigners!.find((s) => s.address !== device?.address)
    expect(nonDeviceSigner).toBeDefined()

    // Transfer 1 wei to the wallet
    const provider = Provider.from(RpcTransport.fromHttp(LOCAL_RPC_URL))
    await provider.request({
      method: 'anvil_setBalance',
      params: [wallet!, '0x1'],
    })

    // Create a new recovery payload
    const requestId2 = await manager.queueRecoveryPayload(wallet!, 42161n, {
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
    const { to, data } = await manager.completeRecoveryPayload(requestId2)

    // Send this transaction to anvil so we queue the payload
    await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          to,
          data,
        },
      ],
    })

    // Wait 3 seconds for the payload to become valid
    await new Promise((resolve) => setTimeout(resolve, 3000))
    await manager.updateQueuedRecoveryPayloads()

    // Get the recovery payloads
    const recoveryPayloads = await new Promise<QueuedRecoveryPayload[]>((resolve) => {
      const unsubscribe = manager.onQueuedRecoveryPayloadsUpdate(
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
    const requestId3 = await manager.requestTransaction(
      wallet!,
      42161n,
      (recoveryPayload!.payload as Payload.Calls).calls,
      {
        noConfigUpdate: true,
      },
    )
    expect(requestId3).toBeDefined()

    // Define the same nonce and space for the recovery payload
    await manager.defineTransaction(requestId3, {
      nonce: (recoveryPayload!.payload as Payload.Calls).nonce,
      space: (recoveryPayload!.payload as Payload.Calls).space,
    })

    // Complete the transaction
    const tx = await manager.getTransaction(requestId3)
    expect(tx).toBeDefined()
    expect(tx.status).toBe('defined')
    expect((tx as TransactionDefined).relayerOptions.length).toBe(1)

    const localRelayer = (tx as TransactionDefined).relayerOptions[0]
    expect(localRelayer).toBeDefined()
    expect(localRelayer.relayerId).toBe('local')

    // Define the relayer
    const requestId4 = await manager.selectTransactionRelayer(requestId3, localRelayer.id)
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
    const txHash = await manager.relayTransaction(requestId4)
    expect(txHash).toBeDefined()

    // The balance of the wallet should be 0 wei
    const balance = await provider.request({
      method: 'eth_getBalance',
      params: [wallet!, 'latest'],
    })
    expect(balance).toBeDefined()
    expect(balance).toBe('0x0')

    // Refresh the queued recovery payloads, the executed one
    // should be removed
    await manager.updateQueuedRecoveryPayloads()
    const recoveryPayloads2 = await new Promise<QueuedRecoveryPayload[]>((resolve) => {
      const unsubscribe = manager.onQueuedRecoveryPayloadsUpdate(
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
})
