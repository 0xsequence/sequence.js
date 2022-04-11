export * from './metadata.gen'

import fetch from 'cross-fetch'

import { Metadata as BaseSequenceMetadata } from './metadata.gen'

export class SequenceMetadataClient extends BaseSequenceMetadata {
  constructor(hostname: string = 'https://metadata.sequence.app') {
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch)
  }
}
