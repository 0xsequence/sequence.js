import { NetworkConfig } from "@arcadeum/provider"
import { BigNumberish, providers } from "ethers"
import { Bridge, Move } from "./bridges"
import { flatten, safeSolve } from "./utils"


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

  async optionsNative(from: NetworkConfig, to: NetworkConfig): Promise<Bridge[]> {
    const available = await Promise.all(this.bridges.map((b) => safeSolve(b.supportsNative(from, to), false)))
    return this.bridges.filter((_, i) => available[i])
  }

  async optionsERC20(from: NetworkConfig, to: NetworkConfig, token: string): Promise<Bridge[]> {
    const available = await Promise.all(this.bridges.map((b) => safeSolve(b.supportsERC20(from, to, token), false)))
    return this.bridges.filter((_, i) => available[i])
  }

  async optionsERC721(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<Bridge[]> {
    const available = await Promise.all(this.bridges.map((b) => safeSolve(b.supportsERC721(from, to, token, ids), false)))
    return this.bridges.filter((_, i) => available[i])
  }

  async optionsERC1155(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<Bridge[]> {
    const available = await Promise.all(this.bridges.map((b) => safeSolve(b.supportsERC1155(from, to, token, ids), false)))
    return this.bridges.filter((_, i) => available[i])
  }

  async getMoves(wallet: string, from: providers.BlockTag = 0, to: providers.BlockTag = "latest"): Promise<Move[]> {
    return flatten(await Promise.all(this.bridges.map((b) => safeSolve(b.getMoves(wallet, from, to), []))))
  }
}
