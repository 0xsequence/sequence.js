export * from './metadata.gen'

import { Metadata as MetadataRpc } from './metadata.gen'

export class SequenceMetadataClient extends MetadataRpc {
  constructor(hostname: string = 'https://metadata.sequence.app') {
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, global.fetch)
  }
}
