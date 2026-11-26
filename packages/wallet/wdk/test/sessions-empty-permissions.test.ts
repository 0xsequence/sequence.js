import { Address } from 'ox'
import { beforeEach, describe, expect, it } from 'vitest'
import { GenericTree, SessionConfig } from '../../primitives/src/index.js'
import { Sessions } from '../src/sequence/sessions.js'
import type { Module } from '../src/sequence/types/index.js'

// Regression tests for session updates with zero permissions.
// The Sessions module is driven with an in-memory state provider and wallet stub, so no chain is needed.

const SESSIONS_EXTENSION: Address.Address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const WALLET: Address.Address = '0xcccccccccccccccccccccccccccccccccccccccc'
const IDENTITY_SIGNER: Address.Address = '0x1111111111111111111111111111111111111111'
const NEW_DEVICE_SIGNER: Address.Address = '0x2222222222222222222222222222222222222222'
const EMPTY_SESSION: Address.Address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const VALID_SESSION: Address.Address = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const TARGET: Address.Address = '0xdddddddddddddddddddddddddddddddddddddddd'

const validPermissions = [{ target: TARGET, rules: [] }]

describe('Sessions with zero-permission sessions', () => {
  let trees: Map<string, GenericTree.Tree>
  let modules: Module[]
  let savedTrees: number
  let updateRequests: Module[][]
  let sessions: Sessions

  const sessionsImageHash = () =>
    modules.find((m) => Address.isEqual(m.sapientLeaf.address, SESSIONS_EXTENSION))!.sapientLeaf.imageHash

  // Stores a sessions topology as the wallet's current sessions module, without going through the SDK's checks
  const storeTopology = (topology: SessionConfig.SessionsTopology) => {
    const tree = SessionConfig.sessionsTopologyToConfigurationTree(topology)
    const imageHash = GenericTree.hash(tree)
    trees.set(imageHash, tree)
    modules = [
      {
        sapientLeaf: { type: 'sapient-signer', address: SESSIONS_EXTENSION, weight: 255n, imageHash },
        weight: 255n,
      },
    ]
  }

  const decodeStored = (imageHash: string) => SessionConfig.configurationTreeToSessionsTopology(trees.get(imageHash)!)

  beforeEach(() => {
    trees = new Map()
    modules = []
    savedTrees = 0
    updateRequests = []
    const shared = {
      sequence: {
        extensions: { sessions: SESSIONS_EXTENSION },
        stateProvider: {
          saveTree: async (tree: GenericTree.Tree) => {
            savedTrees++
            trees.set(GenericTree.hash(tree), tree)
          },
          getTree: async (imageHash: string) => trees.get(imageHash),
        },
      },
      modules: {
        wallets: {
          getConfigurationParts: async () => ({
            loginTopology: { type: 'signer', address: IDENTITY_SIGNER, weight: 1n },
            devicesTopology: { type: 'signer', address: IDENTITY_SIGNER, weight: 1n },
            modules: structuredClone(modules),
          }),
          // Stands in for creating the signature request for the config update
          requestConfigurationUpdate: async (_wallet: Address.Address, changes: { modules: Module[] }) => {
            updateRequests.push(changes.modules)
            return `request-${updateRequests.length}`
          },
        },
      },
    }
    sessions = new Sessions(shared as any)
    storeTopology(
      SessionConfig.addExplicitSession(SessionConfig.emptySessionsTopology(IDENTITY_SIGNER), {
        signer: VALID_SESSION,
        chainId: 1,
        valueLimit: 0n,
        deadline: 0n,
        permissions: validPermissions,
      }),
    )
  })

  describe('rejects empty permissions before any signature request', () => {
    it('addExplicitSession', async () => {
      await expect(
        sessions.addExplicitSession(WALLET, {
          sessionAddress: EMPTY_SESSION,
          chainId: 1,
          valueLimit: 0n,
          deadline: 0n,
          permissions: [],
          type: 'explicit',
        }),
      ).rejects.toThrow('Session permissions must be a non-empty array')
      expect(updateRequests).toHaveLength(0)
      expect(savedTrees).toBe(0)
    })

    it('modifyExplicitSession', async () => {
      await expect(
        sessions.modifyExplicitSession(WALLET, {
          sessionAddress: VALID_SESSION,
          chainId: 1,
          valueLimit: 0n,
          deadline: 0n,
          permissions: [],
          type: 'explicit',
        }),
      ).rejects.toThrow('Session permissions must be a non-empty array')
      expect(updateRequests).toHaveLength(0)
      expect(savedTrees).toBe(0)
    })

    it('addExplicitSession with non-array permissions', async () => {
      await expect(
        sessions.addExplicitSession(WALLET, {
          sessionAddress: EMPTY_SESSION,
          chainId: 1,
          valueLimit: 0n,
          deadline: 0n,
          permissions: {} as any,
          type: 'explicit',
        }),
      ).rejects.toThrow('Session permissions must be a non-empty array')
      expect(updateRequests).toHaveLength(0)
      expect(savedTrees).toBe(0)
    })
  })

  describe('a wallet whose stored tree already holds an empty session', () => {
    beforeEach(async () => {
      const current = await sessions.getTopology(WALLET)
      storeTopology(
        SessionConfig.balanceSessionsTopology(
          SessionConfig.mergeSessionsTopologies(current, {
            type: 'session-permissions',
            signer: EMPTY_SESSION,
            chainId: 1,
            valueLimit: 0n,
            deadline: 0n,
            permissions: [],
          }),
        ),
      )
    })

    it('can read its topology', async () => {
      const topology = await sessions.getTopology(WALLET)
      expect(SessionConfig.getSessionPermissions(topology, EMPTY_SESSION)?.permissions).toEqual([])
      expect(SessionConfig.getSessionPermissions(topology, VALID_SESSION)?.permissions).toHaveLength(1)
    })

    it('can add an identity signer (new-device login)', async () => {
      const nextModules = structuredClone(modules)
      await sessions.addIdentitySignerToModules(nextModules, NEW_DEVICE_SIGNER)
      const imageHash = nextModules[0]!.sapientLeaf.imageHash
      expect(imageHash).not.toBe(sessionsImageHash())
      const updated = decodeStored(imageHash)
      expect(SessionConfig.getIdentitySigners(updated)).toEqual(
        expect.arrayContaining([IDENTITY_SIGNER, NEW_DEVICE_SIGNER]),
      )
    })

    it('can remove the empty session', async () => {
      await sessions.removeExplicitSession(WALLET, EMPTY_SESSION)
      expect(updateRequests).toHaveLength(1)
      const imageHash = updateRequests[0]![0]!.sapientLeaf.imageHash
      const repaired = decodeStored(imageHash)
      expect(SessionConfig.getSessionPermissions(repaired, EMPTY_SESSION)).toBeNull()
      expect(SessionConfig.getSessionPermissions(repaired, VALID_SESSION)?.permissions).toHaveLength(1)
      expect(SessionConfig.getIdentitySigners(repaired)).toEqual([IDENTITY_SIGNER])
    })
  })
})
