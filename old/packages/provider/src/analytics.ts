import { Databeat, Event as DatabeatEvent, Auth, isBrowser } from '@databeat/tracker'

export enum AnalyticsEventType {
  // Core types part of Databeat
  INIT,
  VIEW,

  // Provider specific
  SIGN_MESSAGE_REQUEST,
  SIGN_TYPED_DATA_REQUEST,
  SEND_TRANSACTION_REQUEST
}

export type AnalyticsEventTypes = keyof typeof AnalyticsEventType
export type AnalyticsEvent = DatabeatEvent<AnalyticsEventTypes>

// Analytics sub-class to add some custom helper methods
export class Analytics extends Databeat<AnalyticsEventTypes> {}

// Setup analytics tracker
export const setupAnalytics = (projectAccessKey: string, server?: string) => {
  if (!server) {
    server = 'https://nodes.sequence.app'
  }

  // disable tracking if projectAccessKey is not set
  const noop = !projectAccessKey

  // auth
  const auth: Auth = {}
  if (projectAccessKey) {
    auth.headers = { 'X-Access-Key': projectAccessKey }
  }

  return new Analytics(server, auth, {
    noop: noop,
    defaultEnabled: true,
    privacy: { userIdHash: true, userAgentSalt: false },
    initProps: () => {
      if (!isBrowser()) {
        return {}
      } else {
        return { origin: window.location.origin }
      }
    }
  })
}
