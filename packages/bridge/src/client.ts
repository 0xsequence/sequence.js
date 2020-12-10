import { NetworkConfig } from "@0xsequence/networks"
import { BigNumberish, providers } from "ethers"
import { Bridge, BridgeERC1155, BridgeERC20, BridgeERC721, BridgeNative, isBridgeERC1155, isBridgeERC20, isBridgeNative, Move } from "./bridges"
import { flatten, safeSolve } from "./utils"

export type BridgeOption<T extends Bridge = Bridge> = {
  bridge: T,
  fromChain: NetworkConfig,
  toChain: NetworkConfig
}

export class BridgesClient {
  public bridges: Bridge[]

  constructor(bridges: Bridge[] = [], networks: NetworkConfig[] = []) {
    this.bridges = bridges.map((bridge) => bridge.connect(networks))
  }

  connect(networks: NetworkConfig[]): BridgesClient {
    this.bridges = this.bridges.map((bridge) => bridge.connect(networks))
    return this
  }

  get(id: string): Bridge {
    return this.bridges.find((b) => b.id() === id)
  }

  async optionsNative(from: NetworkConfig, to: NetworkConfig | NetworkConfig[]): Promise<BridgeOption<BridgeNative>[]> {
    if (Array.isArray(to)) return flatten(await Promise.all(to.map((t) => this.optionsNative(from, t))))
    const available = await Promise.all(this.bridges.filter((b) => isBridgeNative(b)).map((b: BridgeNative) => safeSolve(b.supportsNative(from, to), false)))
    return this.bridges.filter((_, i) => available[i]).map((b: BridgeNative) => this.addMeta(from, to, b))
  }

  async optionsERC20(from: NetworkConfig, to: NetworkConfig | NetworkConfig[], token: string): Promise<BridgeOption<BridgeERC20>[]> {
    if (Array.isArray(to)) return flatten(await Promise.all(to.map((t) => this.optionsERC20(from, t, token))))
    const available = await Promise.all(this.bridges.filter((b) => isBridgeERC20(b)).map((b: BridgeERC20) => safeSolve(b.supportsERC20(from, to, token), false)))
    return this.bridges.filter((_, i) => available[i]).map((b: BridgeERC20) => this.addMeta(from, to, b))
  }

  async optionsERC721(from: NetworkConfig, to: NetworkConfig | NetworkConfig[], token: string, ids: BigNumberish[]): Promise<BridgeOption<BridgeERC721>[]> {
    if (Array.isArray(to)) return flatten(await Promise.all(to.map((t) => this.optionsERC721(from, t, token, ids))))
    const available = await Promise.all(this.bridges.filter((b) => isBridgeERC20(b)).map((b: BridgeERC721) => safeSolve(b.supportsERC721(from, to, token, ids), false)))
    return this.bridges.filter((_, i) => available[i]).map((b: BridgeERC721) => this.addMeta(from, to, b))
  }

  async optionsERC1155(from: NetworkConfig, to: NetworkConfig | NetworkConfig[], token: string, ids: BigNumberish[]): Promise<BridgeOption<BridgeERC1155>[]> {
    if (Array.isArray(to)) return flatten(await Promise.all(to.map((t) => this.optionsERC1155(from, t, token, ids))))
    const available = await Promise.all(this.bridges.filter((b) => isBridgeERC1155(b)).map((b: BridgeERC1155) => safeSolve(b.supportsERC1155(from, to, token, ids), false)))
    return this.bridges.filter((_, i) => available[i]).map((b: BridgeERC1155) => this.addMeta(from, to, b))
  }

  async getMoves(wallet: string, from: providers.BlockTag = 0, to: providers.BlockTag = "latest"): Promise<Move[]> {
    return flatten(await Promise.all(this.bridges.map((b) => safeSolve(b.getMoves(wallet, from, to), []))))
  }

  private addMeta<T extends Bridge>(from: NetworkConfig, to: NetworkConfig, bridge: T): BridgeOption<T> {
    return { bridge: bridge, fromChain: from, toChain: to }
  }
}
