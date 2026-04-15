import { Address } from 'ox'
import { describe, expect, it } from 'vitest'

import { Arweave, Reader, Sequence } from '../../../src/state/index'

const TEST_TIMEOUT_MS = 20_000

const tests: { [method in keyof Reader]: { [description: string]: Parameters<Reader[method]> } } = {
  getConfiguration: {
    'image hash: 0xfd32e01d7e814292f49f57e79722ca66423833acf8f25eba770faf3483ff3e78': [
      '0xfd32e01d7e814292f49f57e79722ca66423833acf8f25eba770faf3483ff3e78',
    ],
  },
  getDeploy: {
    'wallet: 0x47E0e44DE649B35Cf7863998Be6C5a7D5d8c63bE': ['0x47E0e44DE649B35Cf7863998Be6C5a7D5d8c63bE'],
  },
  getWallets: {
    'signer: 0x94835215CaA1aD3E304F9A7E2148623fe661dEB7': ['0x94835215CaA1aD3E304F9A7E2148623fe661dEB7'],
  },
  getWalletsForSapient: {
    'signer: 0x000000000000AB36D17eB1150116371520565205, image hash: 0xeef69774e1cb488a71f6d235c858fa564134ee7c3acda9ff116b6c9d42b3cee3':
      [
        '0x000000000000AB36D17eB1150116371520565205',
        '0xeef69774e1cb488a71f6d235c858fa564134ee7c3acda9ff116b6c9d42b3cee3',
      ],
  },
  getWitnessFor: {
    'wallet: 0x47E0e44DE649B35Cf7863998Be6C5a7D5d8c63bE, signer: 0x94835215CaA1aD3E304F9A7E2148623fe661dEB7': [
      '0x47E0e44DE649B35Cf7863998Be6C5a7D5d8c63bE',
      '0x94835215CaA1aD3E304F9A7E2148623fe661dEB7',
    ],
  },
  getWitnessForSapient: {
    'wallet: 0x47E0e44DE649B35Cf7863998Be6C5a7D5d8c63bE, signer: 0x000000000000AB36D17eB1150116371520565205, image hash: 0xeef69774e1cb488a71f6d235c858fa564134ee7c3acda9ff116b6c9d42b3cee3':
      [
        '0x47E0e44DE649B35Cf7863998Be6C5a7D5d8c63bE',
        '0x000000000000AB36D17eB1150116371520565205',
        '0xeef69774e1cb488a71f6d235c858fa564134ee7c3acda9ff116b6c9d42b3cee3',
      ],
  },
  getConfigurationUpdates: {
    'wallet: 0x135769a58639b4Fa7d779a9df9B57A706FBCa816, from: 0xaa14aff91091e94d7521625ab1c713273e86a8c21a0afb6cee35be28af47738a':
      [
        '0x135769a58639b4Fa7d779a9df9B57A706FBCa816',
        '0xaa14aff91091e94d7521625ab1c713273e86a8c21a0afb6cee35be28af47738a',
      ],
  },
  getTree: {
    'image hash: 0xeef69774e1cb488a71f6d235c858fa564134ee7c3acda9ff116b6c9d42b3cee3': [
      '0xeef69774e1cb488a71f6d235c858fa564134ee7c3acda9ff116b6c9d42b3cee3',
    ],
  },
  getPayload: {
    'calls payload: 0xc78f3951686b7f16f39e25aea1fd5acc0e2177083c170b4c962be6cd45630576': [
      '0xc78f3951686b7f16f39e25aea1fd5acc0e2177083c170b4c962be6cd45630576',
    ],
    'message payload: 0x3a841ba3163a7a19cd168373df1144d38130b2f46b8d6eac956127f06fffe4f4': [
      '0x3a841ba3163a7a19cd168373df1144d38130b2f46b8d6eac956127f06fffe4f4',
    ],
    'config update payload: 0xcae631660ffa90bddc5e9b4fa9c11692a53062a61640fb958f3f2959d22fe54b': [
      '0xcae631660ffa90bddc5e9b4fa9c11692a53062a61640fb958f3f2959d22fe54b',
    ],
    'digest payload: 0xcd3c291e0939f029aaa4b4f292d5d2b2ce43baf98046d9abc2a3e8284b253432': [
      '0xcd3c291e0939f029aaa4b4f292d5d2b2ce43baf98046d9abc2a3e8284b253432',
    ],
  },
}

function normalize(value: any): any {
  switch (typeof value) {
    case 'string':
      if (Address.validate(value)) {
        return Address.checksum(value)
      }

      break

    case 'object':
      if (value === null) {
        return value
      }

      if (Array.isArray(value)) {
        return value.map(normalize)
      }

      return Object.fromEntries(
        Object.entries(value)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [Address.validate(key) ? Address.checksum(key) : key, normalize(value)]),
      )
  }

  return value
}

describe('Arweave state reader', () => {
  const arweave = new Arweave.Reader()
  const sequence = new Sequence.Provider()

  const methods = Object.entries(tests).filter(([, methodTests]) => Object.keys(methodTests).length > 0)
  if (methods.length === 0) {
    it.skip('no configured test cases', () => {})
  }

  for (const [method, methodTests] of methods) {
    describe(method, () => {
      for (const [description, args] of Object.entries(methodTests)) {
        it(
          description,
          async () => {
            const [actual, expected] = await Promise.all([arweave[method](...args), sequence[method](...args)])
            expect(normalize(actual)).toEqual(normalize(expected))
          },
          TEST_TIMEOUT_MS,
        )
      }
    })
  }
})
