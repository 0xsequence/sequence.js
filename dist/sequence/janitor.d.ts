import { Shared } from './manager.js'
export declare class Janitor {
  private readonly shared
  private pruneInterval?
  constructor(shared: Shared)
  private startPruning
  prune(): Promise<void>
}
//# sourceMappingURL=janitor.d.ts.map
