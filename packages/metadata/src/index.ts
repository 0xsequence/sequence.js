export * from './metadata.gen'

import { Metadata as MetadataRpc } from './metadata.gen'

const fetch = typeof global === 'object' ? global.fetch : window.fetch

export class SequenceMetadataClient extends MetadataRpc {
  constructor(hostname: string = 'https://metadata.sequence.app') {
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch)
  }
}
