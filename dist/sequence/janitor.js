// Performs cleanup functions and pruning operations
export class Janitor {
  shared
  pruneInterval
  constructor(shared) {
    this.shared = shared
    // Random initial delay between 1-2 seconds
    const initialDelay = 1000 + Math.random() * 1000
    setTimeout(() => this.startPruning(), initialDelay)
  }
  startPruning() {
    // Random interval between 10-20 minutes
    const interval = (10 + Math.random() * 10) * 60 * 1000
    this.pruneInterval = setInterval(() => this.prune(), interval)
    this.prune()
  }
  async prune() {
    const prunedSignatures = await this.shared.modules.signatures?.prune()
    if (prunedSignatures > 0) {
      this.shared.modules.logger.log(`Pruned ${prunedSignatures} signatures`)
    }
  }
}
