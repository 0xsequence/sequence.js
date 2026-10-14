import assert from 'node:assert/strict'
import test from 'node:test'

import { assertSnapshotVersions, snapshotChangeset, validateSnapshotTag } from './prepare-npm-snapshot.mjs'

test('accepts safe snapshot tags', () => {
  for (const tag of ['snapshot', 'canary', 'pre-3.0.14']) {
    assert.doesNotThrow(() => validateSnapshotTag(tag))
  }
})

test('rejects release dist-tags, version-like, and malformed snapshot tags', () => {
  for (const tag of [
    '',
    'latest',
    'v2-legacy',
    '3.0.14',
    'v3.0.14',
    '3.0.14-beta.1',
    'beta tag',
    'Beta',
    'x',
    'x.x',
    'v1.x',
    'v3',
  ]) {
    assert.throws(() => validateSnapshotTag(tag))
  }
})

test('builds a changeset that bumps every publishable package', () => {
  assert.equal(
    snapshotChangeset(['@0xsequence/wallet-core', '@0xsequence/abi']),
    "---\n'@0xsequence/wallet-core': patch\n'@0xsequence/abi': patch\n---\n\nCreate a temporary CI snapshot release.\n",
  )
})

test('requires every publishable package to receive the requested snapshot version', () => {
  const before = [
    { name: '@0xsequence/wallet-core', version: '3.0.14' },
    { name: '@0xsequence/wallet-wdk', version: '3.1.2' },
  ]
  const after = before.map(({ name }) => ({ name, version: '0.0.0-canary-20261014000000' }))

  assert.doesNotThrow(() => assertSnapshotVersions(before, after, 'canary'))
  assert.throws(() => assertSnapshotVersions(before, before, 'canary'), /Snapshot versioning did not change/)
  assert.throws(
    () => assertSnapshotVersions(before, [after[0], before[1]], 'canary'),
    /did not change @0xsequence\/wallet-wdk/,
  )
  assert.throws(() => assertSnapshotVersions(before, [after[0]], 'canary'), /package set changed/)
})
