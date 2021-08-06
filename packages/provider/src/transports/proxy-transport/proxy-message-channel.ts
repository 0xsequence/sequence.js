import { EventEmitter2 as EventEmitter } from 'eventemitter2'
import { ProviderMessage, ProviderMessageTransport, ProviderEventTypes, TypedEventEmitter } from '../../types'

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
  events: TypedEventEmitter<ProxyEventTypes> = new EventEmitter() as TypedEventEmitter<ProxyEventTypes>


  // handle messages which hit this port
  handleMessage = (message: ProviderMessage<any>): void => {
    throw new Error('ProxyMessageChannelPort is not registered')
  }

  // send messages to the connected port
  sendMessage = (message: ProviderMessage<any>): void => {
    this.conn.handleMessage(message)

    // trigger events
    if (message.type === 'open') {
      this.events.emit('open', message as any)
    }
    if (message.type === 'close') {
      this.events.emit('close', message as any)
    }
    if (message.type === 'connect') {
      this.events.emit('connect', message as any)
    }
    if (message.type === 'disconnect') {
      this.events.emit('disconnect', message as any)
    }
  }

  on<K extends keyof ProxyEventTypes>(event: K, fn: ProxyEventTypes[K]) {
    this.events.on(event, fn as any)
  }

  once<K extends keyof ProxyEventTypes>(event: K, fn: ProxyEventTypes[K]) {
    this.events.once(event, fn as any)
  }
}

export type ProxyEventTypes = Pick<ProviderEventTypes, 'open' | 'close' | 'connect' | 'disconnect'>
