import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import { SequenceIndexer, SequenceIndexerOpts } from '@0xsequence/indexer'

const { expect } = chai.use(chaiAsPromised)

describe('SequenceIndexer initialization', () => {
  it('should initialize without arguments', async () => {
    const x = new SequenceIndexer('http://localhost:3000')
    expect(x.jwtAuth).to.be.undefined
    expect(x.projectAccessKey).to.be.undefined
  });

  it('should initialize with PAK', async () => {
    const x = new SequenceIndexer(
      'http://localhost:3000',
      'project-access-key'
    )
    expect(x.jwtAuth).to.be.undefined
    expect(x.projectAccessKey).to.equal('project-access-key')
  })

  it('should initialize with JWT', async () => {
    const x = new SequenceIndexer(
      'http://localhost:3000',
      null,
      'jwt-auth'
    )

    expect(x.jwtAuth).to.equal('jwt-auth')
    expect(x.projectAccessKey).to.be.undefined
  })

  it('should initialize with JWT and PAK', async () => {
    const x = new SequenceIndexer(
      'http://localhost:3000',
      'project-access-key',
      'jwt-auth'
    )

    expect(x.jwtAuth).to.equal('jwt-auth')
    expect(x.projectAccessKey).to.equal('project-access-key')
  })

  it('should initialize with opts', async () => {
    const x = new SequenceIndexer(
      'http://localhost:3000',
      {
        JWTAuth: 'jwt-auth',
        ProjectAccessKey: 'project-access-key'
      }
    )

    expect(x.jwtAuth).to.equal('jwt-auth')
    expect(x.projectAccessKey).to.equal('project-access-key')
  })

  it('should initialize with only PAK in opts', async () => {
    const x = new SequenceIndexer(
      'http://localhost:3000',
      <SequenceIndexerOpts>{
        ProjectAccessKey: 'project-access-key'
      }
    )

    expect(x.jwtAuth).to.be.undefined
    expect(x.projectAccessKey).to.equal('project-access-key')
  })

  it('should initialize with empty opts', async () => {
    const x = new SequenceIndexer(
      'http://localhost:3000',
      <SequenceIndexerOpts>{
      }
    )

    expect(x.jwtAuth).to.be.undefined
    expect(x.projectAccessKey).to.be.undefined
  })

  it('should ignore invalid arguments', async () => {
    const x = new SequenceIndexer(
      'http://localhost:3000',
      {
        A: 'a',
        B: 'b'
      },
    )

    expect(x.jwtAuth).to.be.undefined
    expect(x.projectAccessKey).to.be.undefined
  })
});
