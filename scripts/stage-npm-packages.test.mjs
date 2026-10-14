import assert from 'node:assert/strict'
import test from 'node:test'

import {
  approvalSummary,
  assertTrustedPublishingEnvironment,
  findWorkspaceReferences,
  orderByDependencies,
  selectReleasePackages,
  workspaceDependencyNames,
} from './stage-npm-packages.mjs'

test('selects only publishable workspace packages', () => {
  const workspaces = [
    { name: 'sequence-core', version: null, private: true, path: '/repo' },
    { name: '@0xsequence/wallet-core', version: '3.0.14', private: false, path: '/repo/packages/wallet/core' },
    { name: '@0xsequence/abi', version: '3.0.13', path: '/repo/packages/utils/abi' },
  ]
  assert.deepEqual(
    selectReleasePackages(workspaces).map(({ name }) => name),
    ['@0xsequence/wallet-core', '@0xsequence/abi'],
  )
})

test('rejects publishable packages without a version', () => {
  assert.throws(
    () => selectReleasePackages([{ name: '@0xsequence/abi', path: '/repo/packages/utils/abi' }]),
    /needs a name and version/,
  )
})

test('rejects an empty release set', () => {
  assert.throws(() => selectReleasePackages([{ name: 'root', private: true }]), /No publishable/)
})

test('orders packages after the workspace packages they depend on', () => {
  const ordered = orderByDependencies([
    { name: 'wdk', dependsOn: ['core', 'primitives', 'ox'] },
    { name: 'core', dependsOn: ['primitives'] },
    { name: 'abi', dependsOn: [] },
    { name: 'primitives', dependsOn: [] },
  ])
  assert.deepEqual(
    ordered.map(({ name }) => name),
    ['abi', 'primitives', 'core', 'wdk'],
  )
})

test('rejects workspace dependency cycles', () => {
  assert.throws(
    () =>
      orderByDependencies([
        { name: 'a', dependsOn: ['b'] },
        { name: 'b', dependsOn: ['a'] },
      ]),
    /dependency cycle/,
  )
})

test('collects runtime dependency names but not devDependencies', () => {
  assert.deepEqual(
    workspaceDependencyNames({
      dependencies: { a: 'workspace:^' },
      peerDependencies: { b: '^1.0.0', a: 'workspace:^' },
      devDependencies: { c: 'workspace:*' },
    }),
    ['a', 'b'],
  )
})

test('finds nested workspace protocol references in packed manifests', () => {
  assert.deepEqual(
    findWorkspaceReferences({
      peerDependencies: { sdk: 'workspace:^' },
      publishConfig: { dependencies: { sdk: '^1.2.3' } },
    }),
    ['package.json.peerDependencies.sdk'],
  )
})

test('requires GitHub Actions OIDC before staging', () => {
  assert.throws(() => assertTrustedPublishingEnvironment({}), /CI-only/)
  assert.throws(() => assertTrustedPublishingEnvironment({ GITHUB_ACTIONS: 'true' }), /OIDC is unavailable/)
  assert.doesNotThrow(() =>
    assertTrustedPublishingEnvironment({
      GITHUB_ACTIONS: 'true',
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'token',
      ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/oidc',
    }),
  )
})

test('approval summary keeps earlier-run stages in dependency order and skips published versions', () => {
  const state = (name, published) => ({ releasePackage: { name, version: '3.0.14' }, published })
  const summary = approvalSummary(
    [state('primitives', false), state('abi', true), state('core', false), state('wdk', false)],
    new Set(['core', 'wdk']),
    'latest',
  )
  assert.deepEqual(
    summary.filter((line) => line.startsWith('1. ')),
    [
      '1. `primitives@3.0.14` (staged by an earlier run)',
      '1. `core@3.0.14` (staged by this run)',
      '1. `wdk@3.0.14` (staged by this run)',
    ],
  )
})

test('approval summary reports when nothing is pending', () => {
  const summary = approvalSummary(
    [{ releasePackage: { name: 'abi', version: '3.0.14' }, published: true }],
    new Set(),
    'latest',
  )
  assert.match(summary.join('\n'), /No package versions needed staging/)
})
