import { expect } from 'chai'

import { trackers } from '../src'

describe('Arweave config update grouping', () => {
  const guard = '0x761f5e29944D79d76656323F106CF2efBF5F09e9'
  const user = '0x1111111111111111111111111111111111111111'

  it('Should keep the newest signature of each signer for a config', () => {
    // Newest first, as the Arweave query returns them
    const items = [
      { id: 'guard-new', toImageHash: '0xaa', signer: guard },
      { id: 'user', toImageHash: '0xaa', signer: user },
      { id: 'guard-old', toImageHash: '0xaa', signer: guard },
      { id: 'other-config', toImageHash: '0xbb', signer: user }
    ]

    const { signatures, candidates } = trackers.arweave.groupConfigUpdateItems(items)

    expect(signatures.get('0xaa')!.get(guard)!.id).to.equal('guard-new')
    expect(signatures.get('0xaa')!.get(user)!.id).to.equal('user')
    expect(candidates.map(({ toImageHash }) => toImageHash)).to.deep.equal(['0xaa', '0xbb'])
  })
})
