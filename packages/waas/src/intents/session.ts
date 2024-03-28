import { Intent, makeIntent } from './base'
import {
  IntentDataCloseSession,
  IntentDataFinishValidateSession,
  IntentDataGetSession,
  IntentDataListSessions,
  IntentDataOpenSession,
  IntentDataValidateSession,
  IntentDataSessionAuthProof
} from '../clients/intent.gen'

interface BaseArgs {
  lifespan: number
}

export type OpenSessionArgs = BaseArgs & {
  sessionId: string
  idToken: string
}

export async function openSession({ lifespan, sessionId, idToken }: OpenSessionArgs): Promise<Intent<IntentDataOpenSession>> {
  return makeIntent('openSession', lifespan, {
    sessionId,
    idToken
  })
}

export type ValidateSessionArgs = BaseArgs & IntentDataValidateSession

export async function validateSession({ lifespan, ...data }: ValidateSessionArgs): Promise<Intent<IntentDataValidateSession>> {
  return makeIntent('validateSession', lifespan, data)
}

export type FinishValidateSessionArgs = BaseArgs & IntentDataFinishValidateSession

export function finishValidateSession({ lifespan, ...data }: FinishValidateSessionArgs): Intent<IntentDataFinishValidateSession> {
  return makeIntent('finishValidateSession', lifespan, data)
}

export type CloseSessionArgs = BaseArgs & IntentDataCloseSession

export function closeSession({ lifespan, ...data }: CloseSessionArgs): Intent<IntentDataCloseSession> {
  return makeIntent('closeSession', lifespan, data)
}

export type ListSessionsArgs = BaseArgs & IntentDataListSessions

export function listSessions({ lifespan, ...data }: ListSessionsArgs): Intent<IntentDataListSessions> {
  return makeIntent('listSessions', lifespan, data)
}

export type GetSessionArgs = BaseArgs & IntentDataGetSession

export function getSession({ lifespan, ...data }: GetSessionArgs): Intent<IntentDataGetSession> {
  return makeIntent('getSession', lifespan, data)
}

export type SessionAuthProof = BaseArgs & IntentDataSessionAuthProof

export function sessionAuthProof({ lifespan, ...data }: SessionAuthProof): Intent<IntentDataSessionAuthProof> {
  return makeIntent('sessionAuthProof', lifespan, data)
}
