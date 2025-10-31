import { Network } from '@0xsequence/wallet-primitives'
export { Network as Networks }

export type { ManagerOptions, Databases, Sequence, Modules, Shared } from './manager.js'
export { ManagerOptionsDefaults, CreateWalletOptionsDefaults, applyManagerOptionsDefaults, Manager } from './manager.js'
export { Sessions } from './sessions.js'
export { Signatures } from './signatures.js'
export type {
  StartSignUpWithRedirectArgs,
  CommonSignupArgs,
  PasskeySignupArgs,
  MnemonicSignupArgs,
  EmailOtpSignupArgs,
  CompleteRedirectArgs,
  SignupArgs,
  LoginToWalletArgs,
  LoginToMnemonicArgs,
  LoginToPasskeyArgs,
  LoginArgs,
} from './wallets.js'
export { isLoginToWalletArgs, isLoginToMnemonicArgs, isLoginToPasskeyArgs, Wallets } from './wallets.js'

export * from './types/index.js'
import * as Handlers from './handlers/index.js'
export { Handlers }
