import { JsonRpcProvider, AsyncSendable } from "ethers/providers"
import { Web3Response, Web3Payload } from "../types"

export class JsonRpcAsyncSendable implements AsyncSendable {
  provider: JsonRpcProvider

  constructor(p: JsonRpcProvider) {
      this.provider = p
  }

  sendAsync(payload: Web3Payload, callback: (error: any, response?: Web3Response) => void) {
    this.provider.send(payload.method, payload.params).then((r) => {
      callback(undefined, {
        id: payload.id,
        jsonrpc: "2.0",
        result: r
      })
    }).catch((e) => callback(e))
  }
}
