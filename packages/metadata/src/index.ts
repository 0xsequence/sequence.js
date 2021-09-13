export * from './metadata.gen'

import fetch from 'cross-fetch'

import { Metadata as BaseSequenceMetadata } from './metadata.gen'

export class SequenceMetadataClient extends BaseSequenceMetadata {
  constructor(hostname: string) {
    super(hostname, fetch)
  }
}
