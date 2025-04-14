import { Intent, makeIntent } from './base'
import { IntentDataFederateAccount, IntentDataListAccounts, IntentDataRemoveAccount, IntentName } from '../clients/intent.gen'

interface BaseArgs {
  lifespan: number
}

export type ListAccountsArgs = BaseArgs & IntentDataListAccounts

export function listAccounts({ lifespan, ...data }: ListAccountsArgs): Intent<IntentDataListAccounts> {
  return makeIntent(IntentName.listAccounts, lifespan, data)
}

export type FederateAccountArgs = BaseArgs & IntentDataFederateAccount

export function federateAccount({ lifespan, ...data }: FederateAccountArgs): Intent<IntentDataFederateAccount> {
  return makeIntent(IntentName.federateAccount, lifespan, data)
}

export type RemoveAccountArgs = BaseArgs & IntentDataRemoveAccount

export function removeAccount({ lifespan, ...data }: RemoveAccountArgs): Intent<IntentDataRemoveAccount> {
  return makeIntent(IntentName.removeAccount, lifespan, data)
}
