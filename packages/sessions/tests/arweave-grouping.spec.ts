import { expect } from 'chai'
import { ethers } from 'ethers'

import { trackers } from '../src'

describe('Arweave signature selection', () => {
  const guard = '0x761f5e29944D79d76656323F106CF2efBF5F09e9'
  const user = '0x1111111111111111111111111111111111111111'

  it('Should keep every signature of each signer for a config, newest first', () => {
    // Newest first, as the Arweave query returns them
    const items = [
      { id: 'guard-new', toImageHash: '0xaa', signer: guard },
      { id: 'user', toImageHash: '0xaa', signer: user },
      { id: 'guard-old', toImageHash: '0xaa', signer: guard },
      { id: 'other-config', toImageHash: '0xbb', signer: user }
    ]

    const { signatures, candidates } = trackers.arweave.groupConfigUpdateItems(items)

    expect(
      signatures
        .get('0xaa')!
        .get(guard)!
        .map(({ id }) => id)
    ).to.deep.equal(['guard-new', 'guard-old'])
    expect(
      signatures
        .get('0xaa')!
        .get(user)!
        .map(({ id }) => id)
    ).to.deep.equal(['user'])
    expect(candidates.map(({ toImageHash }) => toImageHash)).to.deep.equal(['0xaa', '0xbb'])
  })

  const load = async (entry: string) => {
    if (entry === 'missing') throw new Error('not found')
    return `sig-${entry}`
  }
  const validity = (map: { [entry: string]: boolean | undefined | 'throw' }) => async (entry: string) => {
    const v = map[entry]
    if (v === 'throw') throw new Error('call failed')
    return v
  }

  it('Should use the newest signature without a validator', async () => {
    const picked = await trackers.arweave.pickSignature(['new', 'old'], load)
    expect(picked).to.deep.equal({ entry: 'new', signature: 'sig-new' })
  })

  it('Should fall back to an older signature when the newest does not validate (e.g. after a rollback)', async () => {
    const picked = await trackers.arweave.pickSignature(['new', 'old'], load, validity({ new: false, old: true }))
    expect(picked).to.deep.equal({ entry: 'old', signature: 'sig-old' })
  })

  it('Should prefer a signature that could not be checked over one that is invalid', async () => {
    const picked = await trackers.arweave.pickSignature(['new', 'old'], load, validity({ new: false, old: undefined }))
    expect(picked).to.deep.equal({ entry: 'old', signature: 'sig-old' })
  })

  it('Should treat a failed check as unknown, not invalid', async () => {
    const picked = await trackers.arweave.pickSignature(['new', 'old'], load, validity({ new: 'throw', old: false }))
    expect(picked).to.deep.equal({ entry: 'new', signature: 'sig-new' })
  })

  it('Should use the newest signature when every signature is invalid', async () => {
    const picked = await trackers.arweave.pickSignature(['new', 'old'], load, validity({ new: false, old: false }))
    expect(picked).to.deep.equal({ entry: 'new', signature: 'sig-new' })
  })

  it('Should skip signatures that cannot be loaded', async () => {
    const picked = await trackers.arweave.pickSignature(['missing', 'old'], load)
    expect(picked).to.deep.equal({ entry: 'old', signature: 'sig-old' })
    expect(await trackers.arweave.pickSignature(['missing'], load)).to.equal(undefined)
  })
})

describe('Arweave signature check', () => {
  const signer = ethers.Wallet.createRandom()
  const digest = ethers.keccak256(ethers.toUtf8Bytes('digest'))

  const eip712Signature = (wallet: ethers.HDNodeWallet) => ethers.concat([wallet.signingKey.sign(digest).serialized, '0x01'])

  it('Should check EOA signatures without a provider', async () => {
    expect(await trackers.arweave.checkSignature(undefined, signer.address, digest, eip712Signature(signer), false)).to.equal(
      true
    )
    const other = ethers.Wallet.createRandom()
    expect(await trackers.arweave.checkSignature(undefined, signer.address, digest, eip712Signature(other), false)).to.equal(
      false
    )
  })

  it('Should not check contract signatures without a provider or without code', async () => {
    expect(await trackers.arweave.checkSignature(undefined, signer.address, digest, '0x1234', true)).to.equal(undefined)
    const noCode = { getCode: async () => '0x' } as unknown as ethers.Provider
    expect(await trackers.arweave.checkSignature(noCode, signer.address, digest, '0x1234', true)).to.equal(undefined)
    const failing = {
      getCode: async () => {
        throw new Error('rpc down')
      }
    } as unknown as ethers.Provider
    expect(await trackers.arweave.checkSignature(failing, signer.address, digest, '0x1234', true)).to.equal(undefined)
  })

  it('Should count a revert from the signer contract as invalid', async () => {
    const reverting = {
      getCode: async () => '0x6000',
      call: async () => {
        throw ethers.makeError('execution reverted', 'CALL_EXCEPTION', {
          action: 'call',
          data: '0x',
          reason: null,
          transaction: { to: null, data: '0x' },
          invocation: null,
          revert: null
        })
      }
    } as unknown as ethers.Provider
    expect(await trackers.arweave.checkSignature(reverting, signer.address, digest, '0x1234', true)).to.equal(false)
  })
})
