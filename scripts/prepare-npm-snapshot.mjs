import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import semver from 'semver'

// Versions every publishable package as `0.0.0-<tag>-<timestamp>` on the CI runner (never
// committed) so stage-npm-packages.mjs can stage a throwaway snapshot. See PUBLISHING.md.

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const changesetDirectory = path.join(repositoryRoot, '.changeset')

export function validateSnapshotTag(tag) {
  assert(tag, 'SNAPSHOT_TAG is required.')
  assert.notEqual(tag, 'latest', "The snapshot tag must not be 'latest'.")
  assert.notEqual(tag, 'v2-legacy', "The snapshot tag must not be 'v2-legacy'.")
  assert(
    /^[a-z][a-z0-9._-]*$/.test(tag),
    'The snapshot tag must start with a lowercase letter and contain only lowercase letters, numbers, dots, underscores, or hyphens.',
  )
  // npm rejects any dist-tag it can parse as a semver range (e.g. '1.2.3', 'v1.x', 'x').
  assert.equal(semver.validRange(tag), null, 'The snapshot tag must not be a version or semver range.')
}

// Every publishable package is bumped so snapshot packages only ever depend on each other,
// never on a workspace version that is not on npm.
export function snapshotChangeset(packageNames) {
  const releases = packageNames.map((name) => `'${name}': patch`).join('\n')
  return `---\n${releases}\n---\n\nCreate a temporary CI snapshot release.\n`
}

export function assertSnapshotVersions(before, after, tag) {
  assert(after.length > 0, 'No publishable packages were found.')
  assert.deepEqual(
    after.map(({ name }) => name).sort(),
    before.map(({ name }) => name).sort(),
    'The publishable package set changed unexpectedly.',
  )

  for (const currentPackage of after) {
    const previousPackage = before.find(({ name }) => name === currentPackage.name)
    assert.notEqual(
      currentPackage.version,
      previousPackage.version,
      `Snapshot versioning did not change ${currentPackage.name}.`,
    )
    assert(
      currentPackage.version.includes(`-${tag}-`),
      `${currentPackage.name} did not receive the requested '${tag}' snapshot version.`,
    )
  }
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.`)
  }
  return result
}

async function readReleasePackages() {
  const result = runChecked('pnpm', ['--recursive', 'list', '--depth', '-1', '--json'], { stdio: 'pipe' })
  const workspaces = JSON.parse(result.stdout).filter((workspace) => workspace.private !== true)
  return Promise.all(
    workspaces.map(async (workspace) => {
      const manifest = JSON.parse(await readFile(path.join(workspace.path, 'package.json'), 'utf8'))
      return { name: manifest.name, version: manifest.version }
    }),
  )
}

async function main() {
  const tag = process.env.SNAPSHOT_TAG
  validateSnapshotTag(tag)

  const before = await readReleasePackages()
  const temporaryChangeset = path.join(changesetDirectory, `ci-snapshot-${process.pid}.md`)
  await writeFile(temporaryChangeset, snapshotChangeset(before.map(({ name }) => name)), {
    encoding: 'utf8',
    flag: 'wx',
  })

  try {
    runChecked('pnpm', ['exec', 'changeset', 'version', '--snapshot', tag])
  } finally {
    await unlink(temporaryChangeset).catch((error) => {
      if (error.code !== 'ENOENT') throw error
    })
  }

  const after = await readReleasePackages()
  assertSnapshotVersions(before, after, tag)
  console.log(`Prepared snapshot versions:\n${after.map(({ name, version }) => `  ${name}@${version}`).join('\n')}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
