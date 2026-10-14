import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFile, mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Packs every publishable workspace package whose version is not yet on npm and sends the
// tarballs to `npm stage publish` via OIDC trusted publishing. CI-only: see PUBLISHING.md.

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const dependencyFields = ['dependencies', 'peerDependencies', 'optionalDependencies']

export function selectReleasePackages(workspaces) {
  const releasePackages = workspaces.filter((workspace) => workspace.private !== true)
  assert(releasePackages.length > 0, 'No publishable workspace packages were found.')
  for (const workspace of releasePackages) {
    assert(workspace.name && workspace.version, `Publishable package at ${workspace.path} needs a name and version.`)
  }
  const names = releasePackages.map((workspace) => workspace.name)
  assert.equal(new Set(names).size, names.length, 'Publishable package names must be unique.')
  return releasePackages
}

// Orders packages so that every package comes after the workspace packages it depends on.
// Maintainers approve staged packages in this order, so dependencies become installable first.
export function orderByDependencies(releasePackages) {
  const names = new Set(releasePackages.map(({ name }) => name))
  const remaining = releasePackages.map((releasePackage) => ({
    releasePackage,
    dependsOn: new Set(
      (releasePackage.dependsOn ?? []).filter((name) => names.has(name) && name !== releasePackage.name),
    ),
  }))
  const ordered = []
  const placed = new Set()
  while (remaining.length > 0) {
    const index = remaining.findIndex(({ dependsOn }) => [...dependsOn].every((name) => placed.has(name)))
    assert(
      index !== -1,
      `Workspace dependency cycle between: ${remaining.map((r) => r.releasePackage.name).join(', ')}`,
    )
    const [{ releasePackage }] = remaining.splice(index, 1)
    ordered.push(releasePackage)
    placed.add(releasePackage.name)
  }
  return ordered
}

export function workspaceDependencyNames(manifest) {
  return [...new Set(dependencyFields.flatMap((field) => Object.keys(manifest[field] ?? {})))]
}

export function findWorkspaceReferences(value, currentPath = 'package.json') {
  if (typeof value === 'string') {
    return value.startsWith('workspace:') ? [currentPath] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findWorkspaceReferences(item, `${currentPath}[${index}]`))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => findWorkspaceReferences(item, `${currentPath}.${key}`))
  }
  return []
}

export function assertTrustedPublishingEnvironment(environment) {
  assert.equal(environment.GITHUB_ACTIONS, 'true', 'Staged publishing is CI-only and must run in GitHub Actions.')
  assert(
    environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN && environment.ACTIONS_ID_TOKEN_REQUEST_URL,
    'GitHub Actions OIDC is unavailable; the job needs id-token: write permission.',
  )
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  })
  if (result.error) throw result.error
  return result
}

function runChecked(command, args, options = {}) {
  const result = run(command, args, options)
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.\n${result.stderr ?? ''}`)
  }
  return result
}

function hasGitTag(tag) {
  const result = run('git', ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`])
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`Unable to check git tag ${tag}.`)
  }
  return result.status === 0
}

function isPublished({ name, version }) {
  const packageSpec = `${name}@${version}`
  const result = run('npm', ['view', packageSpec, 'version', '--json'])
  if (result.status === 0) {
    // npm prints nothing (exit 0) when the package exists but the version does not.
    return result.stdout.trim() !== '' && JSON.parse(result.stdout) === version
  }
  if (/E404|404 Not Found/.test(`${result.stdout}\n${result.stderr}`)) {
    return false
  }
  throw new Error(`Unable to determine whether ${packageSpec} is published.\n${result.stderr}`)
}

function tarballName({ name, version }) {
  return `${name.replace(/^@/, '').replaceAll('/', '-')}-${version}.tgz`
}

async function packPackage(releasePackage, outputDirectory) {
  const tarballPath = path.join(outputDirectory, tarballName(releasePackage))
  runChecked('pnpm', ['--dir', releasePackage.path, 'pack', '--out', tarballPath], {
    stdio: 'inherit',
  })

  const manifestResult = runChecked('tar', ['-xOf', tarballPath, 'package/package.json'])
  const packedManifest = JSON.parse(manifestResult.stdout)
  assert.equal(packedManifest.name, releasePackage.name, 'Packed package name changed unexpectedly.')
  assert.equal(packedManifest.version, releasePackage.version, 'Packed package version changed unexpectedly.')
  assert.deepEqual(
    findWorkspaceReferences(packedManifest),
    [],
    `pnpm did not rewrite every workspace: reference in ${releasePackage.name}.`,
  )
  return tarballPath
}

async function readReleasePackages() {
  const workspacesResult = runChecked('pnpm', ['--recursive', 'list', '--depth', '-1', '--json'])
  const releasePackages = selectReleasePackages(JSON.parse(workspacesResult.stdout))
  const withDependencies = await Promise.all(
    releasePackages.map(async (releasePackage) => {
      const manifest = JSON.parse(await readFile(path.join(releasePackage.path, 'package.json'), 'utf8'))
      return { ...releasePackage, dependsOn: workspaceDependencyNames(manifest) }
    }),
  )
  return orderByDependencies(withDependencies)
}

async function writeSummary(lines) {
  if (!process.env.GITHUB_STEP_SUMMARY) return
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, 'utf8')
}

async function main() {
  assertTrustedPublishingEnvironment(process.env)
  const distTag = process.env.NPM_STAGE_TAG || 'latest'
  const createGitTags = process.env.NPM_STAGE_CREATE_GIT_TAGS !== 'false'

  const releasePackages = await readReleasePackages()
  const releaseStates = releasePackages.map((releasePackage) => {
    const tag = `${releasePackage.name}@${releasePackage.version}`
    // A tagged but unpublished version was staged by an earlier run and still awaits approval.
    const tagged = createGitTags && hasGitTag(tag)
    const published = isPublished(releasePackage)
    return { releasePackage, tag, tagged, published }
  })
  const packagesToStage = releaseStates.filter((state) => !state.tagged && !state.published)

  const outputDirectory =
    packagesToStage.length > 0 ? await mkdtemp(path.join(os.tmpdir(), 'sequence-npm-stage-')) : null
  const stagedNow = new Set()
  for (const { releasePackage } of packagesToStage) {
    const tarballPath = await packPackage(releasePackage, outputDirectory)
    runChecked('npm', ['stage', 'publish', tarballPath, '--tag', distTag, '--access', 'public', '--provenance'], {
      stdio: 'inherit',
    })
    stagedNow.add(releasePackage.name)
    // changesets/action v1 creates this package's tag and GitHub Release from this line,
    // even if a later package fails. A retry can then skip the already-staged package by tag.
    if (createGitTags) {
      console.log(`New tag: ${releasePackage.name}@${releasePackage.version}`)
    }
  }

  const summary = approvalSummary(releaseStates, stagedNow, distTag)
  console.log(summary.join('\n'))
  await writeSummary(summary)
}

// Lists every unpublished version of the release in dependency order, including versions an
// earlier (partially failed) run staged, so maintainers approve dependencies first.
export function approvalSummary(releaseStates, stagedNow, distTag) {
  const pending = releaseStates.filter((state) => !state.published)
  if (pending.length === 0) {
    return ['### npm staged publishing', '', 'No package versions needed staging.']
  }
  return [
    '### npm staged publishing',
    '',
    `Approve in this order (dependencies first); all are staged under \`${distTag}\`:`,
    '',
    ...pending.map(({ releasePackage: { name, version } }) => {
      const origin = stagedNow.has(name) ? 'staged by this run' : 'staged by an earlier run'
      return `1. \`${name}@${version}\` (${origin})`
    }),
    '',
    'A maintainer must approve every staged package on npm with 2FA before it is installable.',
  ]
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
