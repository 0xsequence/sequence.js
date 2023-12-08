import { Databeat, Event as DatabeatEvent } from '@databeat/tracker'

export enum EventType {
  // Core types part of Databeat
  INIT,
  VIEW,

  // CONNECT, OPEN, DISCONNECT, ......

  // SIGN_MESSAGE
  // SEND_TRANSACTION ......
  // props...? from the dapp, etc...... prob pass the "origin".....
}

export type EventTypes = keyof typeof EventType
export type Event = DatabeatEvent<EventTypes>

// Analytics sub-class to add some custom helper methods
class Analytics extends Databeat<EventTypes> {
}


// Setup analytics tracker
// const databeatServer = ''
// export const analytics = new Analytics(databeatServer, '') // TODO: jwt key......? hmpf... lets think on it..

export const setupAnalytics = (projectAccessKey: string, server: string) => {
  // TODO: only track if projectAccessKey is passed
  return new Analytics(server, '')
}
