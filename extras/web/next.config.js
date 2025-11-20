import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.join(__dirname, '..', '..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Anchor output tracing to the monorepo root so Next.js doesn't pick up
  // sibling lockfiles and mis-detect the workspace boundary during lint/build.
  outputFileTracingRoot: workspaceRoot,
}

export default nextConfig
