import { expect } from 'chai'

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

  it('Should use the newest signature without a validator', async () => {
    const picked = await trackers.arweave.pickSignature(['new', 'old'], load)
    expect(picked).to.deep.equal({ entry: 'new', signature: 'sig-new' })
  })

  it('Should fall back to an older signature when the newest does not validate (e.g. after a rollback)', async () => {
    const picked = await trackers.arweave.pickSignature(['new', 'old'], load, async entry => entry === 'old')
    expect(picked).to.deep.equal({ entry: 'old', signature: 'sig-old' })
  })

  it('Should use the newest signature when none validates, and treat validation errors as invalid', async () => {
    const picked = await trackers.arweave.pickSignature(['new', 'old'], load, async entry => {
      if (entry === 'new') throw new Error('call reverted')
      return false
    })
    expect(picked).to.deep.equal({ entry: 'new', signature: 'sig-new' })
  })

  it('Should skip signatures that cannot be loaded', async () => {
    const picked = await trackers.arweave.pickSignature(['missing', 'old'], load)
    expect(picked).to.deep.equal({ entry: 'old', signature: 'sig-old' })
    expect(await trackers.arweave.pickSignature(['missing'], load)).to.equal(undefined)
  })
})
