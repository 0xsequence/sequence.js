import { afterEach, describe, expect, it, vi } from 'vitest'
import { Secp256k1 } from 'ox'

import { ChainSessionManager } from '../src/ChainSessionManager.js'
import { DappClient } from '../src/DappClient.js'
import { TransportMode } from '../src/types/index.js'
import { WebStorage } from '../src/utils/storage.js'

describe('ETHAuth proof persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('persists ETHAuth proof only when requested during createNewSession', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', { fetch: fetchMock } as any)

    const ethAuthProof = {
      typedData: {
        domain: {},
        types: {},
        message: {},
      },
      ewtString: 'proof-string',
    } as any

    const sequenceStorage = {
      setPendingRedirectRequest: vi.fn().mockResolvedValue(undefined),
      isRedirectRequestPending: vi.fn().mockResolvedValue(false),
      saveTempSessionPk: vi.fn().mockResolvedValue(undefined),
      getAndClearTempSessionPk: vi.fn().mockResolvedValue(null),
      savePendingRequest: vi.fn().mockResolvedValue(undefined),
      getAndClearPendingRequest: vi.fn().mockResolvedValue(null),
      peekPendingRequest: vi.fn().mockResolvedValue(null),
      saveExplicitSession: vi.fn().mockResolvedValue(undefined),
      getExplicitSessions: vi.fn().mockResolvedValue([]),
      clearExplicitSessions: vi.fn().mockResolvedValue(undefined),
      saveImplicitSession: vi.fn().mockResolvedValue(undefined),
      getImplicitSession: vi.fn().mockResolvedValue(null),
      clearImplicitSession: vi.fn().mockResolvedValue(undefined),
      saveSessionlessConnection: vi.fn().mockResolvedValue(undefined),
      getSessionlessConnection: vi.fn().mockResolvedValue(null),
      clearSessionlessConnection: vi.fn().mockResolvedValue(undefined),
      saveEthAuthProof: vi.fn().mockResolvedValue(undefined),
      getEthAuthProof: vi.fn().mockResolvedValue(ethAuthProof),
      clearEthAuthProof: vi.fn().mockResolvedValue(undefined),
      clearAllData: vi.fn().mockResolvedValue(undefined),
    } as any

    const transport = {
      mode: TransportMode.POPUP,
      sendRequest: vi.fn().mockResolvedValue({
        walletAddress: '0x1111111111111111111111111111111111111111',
        ethAuthProof,
      }),
      closeWallet: vi.fn(),
    } as any

    const manager = new ChainSessionManager(
      1,
      transport,
      'test-project-access-key',
      'https://keymachine.sequence.app',
      'https://nodes.sequence.app/{network}',
      'https://{network}-relayer.sequence.app',
      sequenceStorage,
      'https://example.com/redirect',
      undefined,
      vi.fn(() => Secp256k1.randomPrivateKey()),
      false,
    )

    await manager.createNewSession('https://example.com', undefined, {
      ethAuth: {
        app: 'app-name',
      },
    })

    expect(sequenceStorage.saveEthAuthProof).toHaveBeenCalledWith(ethAuthProof)
    expect(sequenceStorage.clearEthAuthProof).not.toHaveBeenCalled()
  })

  it('clears ETHAuth proof on disconnect', async () => {
    const sequenceStorage = new WebStorage()
    const client = new DappClient('https://wallet.example', 'https://dapp.example', 'test-project-access-key', {
      sequenceStorage,
    })

    const ethAuthProof = {
      typedData: {
        domain: {},
        types: {},
        message: {},
      },
      ewtString: 'proof-string',
    } as any

    await sequenceStorage.saveEthAuthProof(ethAuthProof)
    expect(await client.getEthAuthProof()).toEqual(ethAuthProof)

    await client.disconnect()

    expect(await client.getEthAuthProof()).toBeNull()
  })
})
