export * from './indexer.gen'

import fetch from 'cross-fetch'

import { Indexer as BaseSequenceIndexer } from './indexer.gen'

export class SequenceIndexerClient extends BaseSequenceIndexer {
  constructor(hostname: string) {
    super(hostname, fetch)
  }
}
