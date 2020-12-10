import { ProviderMessage, ProviderMessageTransport } from '../../types'

export class ProxyMessageChannel {
  app: ProxyMessageChannelPort
  wallet: ProxyMessageChannelPort

  constructor() {
    const port1 = new ProxyMessageChannelPort()
    const port2 = new ProxyMessageChannelPort()

    port1.conn = port2
    port2.conn = port1

    this.app = port1
    this.wallet = port2
  }
}

export class ProxyMessageChannelPort implements ProviderMessageTransport {
  conn: ProviderMessageTransport

  handleMessage = (message: ProviderMessage<any>): void => {
    throw Error('ProxyMessageChannelPort is not registered')
  }

  sendMessage = (message: ProviderMessage<any>): void => {
    this.conn.handleMessage(message)
  }
}
