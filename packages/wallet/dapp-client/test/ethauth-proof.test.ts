import { afterEach, describe, expect, it, vi } from 'vitest'

import { DappClient } from '../src/DappClient.js'
import { DappTransport } from '../src/DappTransport.js'
import { RequestActionType, TransportMode } from '../src/types/index.js'
import { WebStorage } from '../src/utils/storage.js'

describe('ETHAuth proof persistence', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const createSequenceStorageMock = () =>
    ({
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
      getEthAuthProof: vi.fn().mockResolvedValue(null),
      clearEthAuthProof: vi.fn().mockResolvedValue(undefined),
      clearAllData: vi.fn().mockResolvedValue(undefined),
    }) as any

  it('persists ETHAuth proof when connect requests ethAuth in redirect mode', async () => {
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

    const sequenceStorage = createSequenceStorageMock()
    const sendRequestMock = vi.spyOn(DappTransport.prototype, 'sendRequest').mockResolvedValue({
      walletAddress: '0x1111111111111111111111111111111111111111',
      ethAuthProof,
    } as any)

    const client = new DappClient('https://wallet.example', 'https://dapp.example', 'test-project-access-key', {
      sequenceStorage,
      transportMode: TransportMode.REDIRECT,
      canUseIndexedDb: false,
      redirectActionHandler: vi.fn(),
    })

    await client.connect(1, undefined, {
      ethAuth: {
        app: 'app-name',
      },
    })

    expect(sendRequestMock).toHaveBeenCalledWith(
      RequestActionType.CREATE_NEW_SESSION,
      'https://dapp.example',
      expect.objectContaining({
        ethAuth: {
          app: 'app-name',
        },
      }),
      expect.any(Object),
    )
    expect(sequenceStorage.saveEthAuthProof).toHaveBeenCalledWith(ethAuthProof)
  })

  it('persists ETHAuth proof when connect requests ethAuth in popup mode', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', { fetch: fetchMock } as any)
    vi.stubGlobal('document', {} as any)

    const ethAuthProof = {
      typedData: {
        domain: {},
        types: {},
        message: {},
      },
      ewtString: 'proof-string',
    } as any

    const sequenceStorage = createSequenceStorageMock()
    const sendRequestMock = vi.spyOn(DappTransport.prototype, 'sendRequest').mockResolvedValue({
      walletAddress: '0x1111111111111111111111111111111111111111',
      ethAuthProof,
    } as any)

    const client = new DappClient('https://wallet.example', 'https://dapp.example', 'test-project-access-key', {
      sequenceStorage,
      transportMode: TransportMode.POPUP,
      canUseIndexedDb: false,
    })

    await client.connect(1, undefined, {
      ethAuth: {
        app: 'app-name',
      },
    })

    expect(sendRequestMock).toHaveBeenCalledWith(
      RequestActionType.CREATE_NEW_SESSION,
      'https://dapp.example',
      expect.objectContaining({
        ethAuth: {
          app: 'app-name',
        },
      }),
      expect.any(Object),
    )
    expect(sequenceStorage.saveEthAuthProof).toHaveBeenCalledWith(ethAuthProof)
  })

  it('does not persist ETHAuth proof when connect does not request ethAuth', async () => {
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

    const sequenceStorage = createSequenceStorageMock()
    const sendRequestMock = vi.spyOn(DappTransport.prototype, 'sendRequest').mockResolvedValue({
      walletAddress: '0x1111111111111111111111111111111111111111',
      ethAuthProof,
    } as any)

    const client = new DappClient('https://wallet.example', 'https://dapp.example', 'test-project-access-key', {
      sequenceStorage,
      transportMode: TransportMode.REDIRECT,
      canUseIndexedDb: false,
      redirectActionHandler: vi.fn(),
    })

    await client.connect(1)

    expect(sendRequestMock).toHaveBeenCalledWith(
      RequestActionType.CREATE_NEW_SESSION,
      'https://dapp.example',
      expect.not.objectContaining({
        ethAuth: expect.anything(),
      }),
      expect.any(Object),
    )
    expect(sequenceStorage.saveEthAuthProof).not.toHaveBeenCalled()
  })

  it('clears ETHAuth proof on disconnect', async () => {
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

    vi.spyOn(DappTransport.prototype, 'sendRequest').mockResolvedValue({
      walletAddress: '0x1111111111111111111111111111111111111111',
      ethAuthProof,
    } as any)

    const client = new DappClient('https://wallet.example', 'https://dapp.example', 'test-project-access-key', {
      sequenceStorage: new WebStorage(),
      transportMode: TransportMode.REDIRECT,
      canUseIndexedDb: false,
      redirectActionHandler: vi.fn(),
    })

    await client.connect(1, undefined, {
      ethAuth: {
        app: 'app-name',
      },
    })

    expect(await client.getEthAuthProof()).toEqual(ethAuthProof)

    await client.disconnect()

    expect(await client.getEthAuthProof()).toBeNull()
  })
})
