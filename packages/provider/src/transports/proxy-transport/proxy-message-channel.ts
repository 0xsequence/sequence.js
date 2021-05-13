import EventEmitter from 'eventemitter3'
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
  events: EventEmitter<ProxyMessageEvent, any> = new EventEmitter()

  // handle messages which hit this port
  handleMessage = (message: ProviderMessage<any>): void => {
    throw new Error('ProxyMessageChannelPort is not registered')
  }

  // send messages to the connected port
  sendMessage = (message: ProviderMessage<any>): void => {
    this.conn.handleMessage(message)

    // trigger events
    if (message.type === 'open') {
      this.events.emit('open', message)
    }
    if (message.type === 'close') {
      this.events.emit('close', message)
    }
    if (message.type === 'connect') {
      this.events.emit('connect', message)
    }
    if (message.type === 'disconnect') {
      this.events.emit('disconnect', message)
    }
  }

  on(event: ProxyMessageEvent, fn: (...args: any[]) => void) {
    this.events.on(event, fn)
  }

  once(event: ProxyMessageEvent, fn: (...args: any[]) => void) {
    this.events.once(event, fn)
  }
}

type ProxyMessageEvent = 'open' | 'close' | 'connect' | 'disconnect'
