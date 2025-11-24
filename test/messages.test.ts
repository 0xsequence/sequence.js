import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Manager, SignerActionable } from '../src/sequence'
import { Mnemonic } from 'ox'
import { newManager } from './constants'
import { Network } from '@0xsequence/wallet-primitives'

describe('Messages', () => {
  let manager: Manager

  beforeEach(() => {
    manager = newManager()
  })

  afterEach(async () => {
    await manager.stop()
  })

  // === BASIC MESSAGE MANAGEMENT ===

  it('Should start with empty message list', async () => {
    const messages = await manager.messages.list()
    expect(messages).toEqual([])
  })

  it('Should create a basic message request', async () => {
    // Create a wallet first
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })
    expect(wallet).toBeDefined()

    const testMessage = 'Hello, World!'

    // Create message request
    const signatureId = await manager.messages.request(wallet!, testMessage)
    expect(signatureId).toBeDefined()
    expect(typeof signatureId).toBe('string')

    // Verify message appears in list
    const messages = await manager.messages.list()
    expect(messages.length).toBe(1)
    expect(messages[0].wallet).toBe(wallet)
    expect(messages[0].message).toBe(testMessage)
    expect(messages[0].status).toBe('requested')
    expect(messages[0].signatureId).toBe(signatureId)
    expect(messages[0].source).toBe('unknown')
    expect(messages[0].id).toBeDefined()
  })

  it('Should create message request with custom source', async () => {
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const testMessage = 'Custom source message'
    const customSource = 'test-dapp.com'

    await manager.messages.request(wallet!, testMessage, undefined, { source: customSource })

    const messages = await manager.messages.list()
    expect(messages.length).toBe(1)
    expect(messages[0].source).toBe(customSource)
    expect(messages[0].message).toBe(testMessage)
  })

  it('Should get message by ID', async () => {
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const testMessage = 'Test message for retrieval'
    const signatureId = await manager.messages.request(wallet!, testMessage)

    const messages = await manager.messages.list()
    expect(messages.length).toBe(1)
    const messageId = messages[0].id

    // Get by message ID
    const retrievedMessage = await manager.messages.get(messageId)
    expect(retrievedMessage.id).toBe(messageId)
    expect(retrievedMessage.message).toBe(testMessage)
    expect(retrievedMessage.signatureId).toBe(signatureId)

    // Get by signature ID
    const retrievedBySignature = await manager.messages.get(signatureId)
    expect(retrievedBySignature.id).toBe(messageId)
    expect(retrievedBySignature.message).toBe(testMessage)
  })

  it('Should throw error when getting non-existent message', async () => {
    await expect(manager.messages.get('non-existent-id')).rejects.toThrow('Message non-existent-id not found')
  })

  it('Should complete message signing flow', async () => {
    const mnemonic = Mnemonic.random(Mnemonic.english)

    const wallet = await manager.wallets.signUp({
      mnemonic,
      kind: 'mnemonic',
      noGuard: true,
    })

    const testMessage = 'Message to be signed'
    const signatureId = await manager.messages.request(wallet!, testMessage)

    // Register mnemonic UI for signing
    const unregisterUI = manager.registerMnemonicUI(async (respond) => {
      await respond(mnemonic)
    })

    try {
      // Get and sign the signature request
      const sigRequest = await manager.signatures.get(signatureId)
      const mnemonicSigner = sigRequest.signers.find((s) => s.handler?.kind === 'login-mnemonic')
      expect(mnemonicSigner?.status).toBe('actionable')

      await (mnemonicSigner as SignerActionable).handle()

      // Complete the message
      const messageSignature = await manager.messages.complete(signatureId)
      expect(messageSignature).toBeDefined()
      expect(typeof messageSignature).toBe('string')
      expect(messageSignature.startsWith('0x')).toBe(true)

      // Verify message status is now 'signed'
      const completedMessage = await manager.messages.get(signatureId)
      expect(completedMessage.status).toBe('signed')
      expect((completedMessage as any).messageSignature).toBe(messageSignature)
    } finally {
      unregisterUI()
    }
  })

  it('Should delete message request', async () => {
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const testMessage = 'Message to be deleted'
    const signatureId = await manager.messages.request(wallet!, testMessage)

    // Verify message exists
    let messages = await manager.messages.list()
    expect(messages.length).toBe(1)

    // Delete the message
    await manager.messages.delete(signatureId)

    // Verify message is gone
    messages = await manager.messages.list()
    expect(messages.length).toBe(0)

    // Should throw when getting deleted message
    await expect(manager.messages.get(signatureId)).rejects.toThrow('Message ' + signatureId + ' not found')
  })

  it('Should handle multiple message requests', async () => {
    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    // Create multiple messages
    const messageTexts = ['First message', 'Second message', 'Third message']

    const signatureIds: string[] = []
    for (const msg of messageTexts) {
      const sigId = await manager.messages.request(wallet!, msg)
      signatureIds.push(sigId)
    }

    expect(signatureIds.length).toBe(3)
    expect(new Set(signatureIds).size).toBe(3) // All unique

    const messageList = await manager.messages.list()
    expect(messageList.length).toBe(3)

    // Verify all messages are present
    const actualMessages = messageList.map((m) => m.message)
    messageTexts.forEach((msg) => {
      expect(actualMessages).toContain(msg)
    })
  })

  it('Should subscribe to messages updates', async () => {
    manager = newManager(undefined, undefined, `msg_sub_${Date.now()}`)

    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    let updateCallCount = 0
    let lastMessages: any[] = []

    const unsubscribe = manager.messages.onMessagesUpdate((messages) => {
      updateCallCount++
      lastMessages = messages
    })

    try {
      // Create a message - should trigger update
      const testMessage = 'Subscription test message'
      await manager.messages.request(wallet!, testMessage)

      // Wait a bit for async update
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(updateCallCount).toBeGreaterThan(0)
      expect(lastMessages.length).toBe(1)
      expect(lastMessages[0].message).toBe(testMessage)
    } finally {
      unsubscribe()
    }
  })

  it('Should trigger messages update callback immediately when trigger=true', async () => {
    manager = newManager(undefined, undefined, `msg_trigger_${Date.now()}`)

    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    // Create a message first
    await manager.messages.request(wallet!, 'Pre-existing message')

    let immediateCallCount = 0
    let receivedMessages: any[] = []

    const unsubscribe = manager.messages.onMessagesUpdate((messages) => {
      immediateCallCount++
      receivedMessages = messages
    }, true) // trigger=true for immediate callback

    // Wait a bit for the async trigger callback
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Should have been called immediately
    expect(immediateCallCount).toBe(1)
    expect(receivedMessages.length).toBe(1)
    expect(receivedMessages[0].message).toBe('Pre-existing message')

    unsubscribe()
  })

  it('Should subscribe to single message updates', async () => {
    manager = newManager(undefined, undefined, `msg_single_sub_${Date.now()}`)
    const mnemonic = Mnemonic.random(Mnemonic.english)

    const wallet = await manager.wallets.signUp({
      mnemonic,
      kind: 'mnemonic',
      noGuard: true,
    })

    const testMessage = 'Single message subscription test'
    const signatureId = await manager.messages.request(wallet!, testMessage)

    const messages = await manager.messages.list()
    const messageId = messages[0].id

    let updateCallCount = 0
    let lastMessage: any

    const unsubscribe = manager.messages.onMessageUpdate(messageId, (message) => {
      updateCallCount++
      lastMessage = message
    })

    try {
      // Sign the message to trigger an update
      const unregisterUI = manager.registerMnemonicUI(async (respond) => {
        await respond(mnemonic)
      })

      const sigRequest = await manager.signatures.get(signatureId)
      const mnemonicSigner = sigRequest.signers.find((s) => s.handler?.kind === 'login-mnemonic')
      await (mnemonicSigner as SignerActionable).handle()
      unregisterUI()

      await manager.messages.complete(signatureId)

      // Wait for async update
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(updateCallCount).toBeGreaterThan(0)
      expect(lastMessage?.status).toBe('signed')
    } finally {
      unsubscribe()
    }
  })

  it('Should trigger single message update callback immediately when trigger=true', async () => {
    manager = newManager(undefined, undefined, `msg_single_trigger_${Date.now()}`)

    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const testMessage = 'Immediate single message trigger test'
    await manager.messages.request(wallet!, testMessage)

    const messages = await manager.messages.list()
    const messageId = messages[0].id

    let callCount = 0
    let receivedMessage: any

    const unsubscribe = manager.messages.onMessageUpdate(
      messageId,
      (message) => {
        callCount++
        receivedMessage = message
      },
      true,
    ) // trigger=true for immediate callback

    // Wait a bit for the async trigger callback
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Should have been called immediately
    expect(callCount).toBe(1)
    expect(receivedMessage?.id).toBe(messageId)
    expect(receivedMessage?.message).toBe(testMessage)

    unsubscribe()
  })

  it('Should handle message completion with chainId and network lookup', async () => {
    manager = newManager(undefined, undefined, `msg_chainid_${Date.now()}`)
    const mnemonic = Mnemonic.random(Mnemonic.english)

    const wallet = await manager.wallets.signUp({
      mnemonic,
      kind: 'mnemonic',
      noGuard: true,
    })

    const testMessage = 'Message with chainId for network lookup'
    const signatureId = await manager.messages.request(wallet!, testMessage, Network.ChainId.ARBITRUM)

    const unregisterUI = manager.registerMnemonicUI(async (respond) => {
      await respond(mnemonic)
    })

    try {
      const sigRequest = await manager.signatures.get(signatureId)
      const mnemonicSigner = sigRequest.signers.find((s) => s.handler?.kind === 'login-mnemonic')
      await (mnemonicSigner as SignerActionable).handle()

      // This should trigger the network lookup code path (lines 194-200)
      const messageSignature = await manager.messages.complete(signatureId)
      expect(messageSignature).toBeDefined()
      expect(typeof messageSignature).toBe('string')
      expect(messageSignature.startsWith('0x')).toBe(true)
    } finally {
      unregisterUI()
    }
  })

  it('Should throw error for unsupported network in message completion', async () => {
    manager = newManager(undefined, undefined, `msg_bad_network_${Date.now()}`)
    const mnemonic = Mnemonic.random(Mnemonic.english)

    const wallet = await manager.wallets.signUp({
      mnemonic,
      kind: 'mnemonic',
      noGuard: true,
    })

    const testMessage = 'Message with unsupported chainId'
    // Use an unsupported chainId
    const signatureId = await manager.messages.request(wallet!, testMessage, 999999)

    const unregisterUI = manager.registerMnemonicUI(async (respond) => {
      await respond(mnemonic)
    })

    try {
      const sigRequest = await manager.signatures.get(signatureId)
      const mnemonicSigner = sigRequest.signers.find((s) => s.handler?.kind === 'login-mnemonic')
      await (mnemonicSigner as SignerActionable).handle()

      // This should trigger the network not found error (lines 195-196)
      await expect(manager.messages.complete(signatureId)).rejects.toThrow('Network not found for 999999')
    } finally {
      unregisterUI()
    }
  })

  it('Should handle delete with non-existent message gracefully', async () => {
    manager = newManager(undefined, undefined, `msg_delete_error_${Date.now()}`)

    // This should trigger the catch block in delete (line 247)
    // Should not throw, just silently ignore
    await expect(manager.messages.delete('non-existent-message-id')).resolves.toBeUndefined()
  })

  it('Should throw insufficient weight error when completing unsigned message', async () => {
    manager = newManager(undefined, undefined, `msg_insufficient_weight_${Date.now()}`)

    const wallet = await manager.wallets.signUp({
      mnemonic: Mnemonic.random(Mnemonic.english),
      kind: 'mnemonic',
      noGuard: true,
    })

    const testMessage = 'Message with insufficient weight'
    const signatureId = await manager.messages.request(wallet!, testMessage)

    // Try to complete without signing - should trigger insufficient weight error (lines 188-189)
    await expect(manager.messages.complete(signatureId)).rejects.toThrow('insufficient weight')
  })
})
