import { Address } from '@0xsequence/wallet-primitives'

/**
 * Represents the local state of a managed wallet session within the SDK.
 * This object contains information about the current session, not just the on-chain state.
 */
export interface Wallet {
  /**
   * The unique, on-chain address of the wallet.
   * @property
   */
  address: Address.Checksummed

  /**
   * The current status of the wallet's session in the manager.
   * - `ready`: The wallet is fully logged in and available for signing and sending transactions.
   * - `logging-in`: A login process has been initiated but is not yet complete. The wallet is not yet usable.
   * - `logging-out`: A hard logout process has been initiated but is not yet complete. The wallet is being removed.
   * @property
   */
  status: 'ready' | 'logging-in' | 'logging-out'

  /**
   * The ISO 8601 timestamp of when the current session was established.
   * @property
   */
  loginDate: string

  /**
   * The address of the temporary, session-specific key for this device.
   * This key is added to the wallet's on-chain configuration upon login and is used for
   * most signing operations, avoiding the need to use the primary login credential repeatedly.
   * @property
   */
  device: Address.Checksummed

  /**
   * A string identifier for the authentication method used for this session.
   * Examples: 'login-mnemonic', 'login-passkey', 'login-google-pkce'.
   * @property
   */
  loginType: string

  /**
   * Indicates whether the wallet's configuration includes a security guard module (e.g., for 2FA).
   * This is a reflection of the on-chain configuration at the time of login.
   * @property
   */
  useGuard: boolean

  /**
   * The email address associated with the login, if available (e.g., from an email OTP or social login).
   * This is optional and used primarily for display purposes in the UI.
   * @property
   */
  loginEmail?: string
}

/**
 * Provides contextual information to a `WalletSelectionUiHandler` about how it was invoked.
 * This helps the UI adapt its presentation (e.g., full-page vs. modal).
 */
export type WalletSelectionContext = {
  /**
   * `true` if the wallet selection was triggered as part of an OAuth redirect flow.
   * @property
   */
  isRedirect: boolean

  /**
   * If `isRedirect` is true, this is the original URL the user intended to visit before the
   * authentication redirect, allowing the app to return them there after completion.
   * @property
   */
  target?: string

  /**
   * The kind of authentication method that initiated the flow (e.g., 'google-pkce').
   * @property
   */
  signupKind?: string
}

/**
 * The set of options passed to a `WalletSelectionUiHandler` when a user attempts to sign up
 * with a credential that is already associated with one or more existing wallets.
 */
export type WalletSelectionOptions = {
  /**
   * An array of wallet addresses that are already configured to use the provided credential (`signerAddress`).
   * The UI should present these as login options.
   * @property
   */
  existingWallets: Address.Checksummed[]

  /**
   * The address of the signer/credential that triggered this selection flow (e.g., a passkey's public key address).
   * @property
   */
  signerAddress: Address.Checksummed

  /**
   * Additional context about how the selection handler was invoked.
   * @property
   */
  context: WalletSelectionContext
}

/**
 * Defines the signature for a function that handles the UI for wallet selection.
 *
 * When a user attempts to sign up, the SDK may discover that their credential (e.g., passkey, social account)
 * is already a signer for existing wallets. This handler is then called to let the user decide how to proceed.
 *
 * @param options - The `WalletSelectionOptions` containing the list of existing wallets and context.
 * @returns A promise that resolves with one of the following:
 * - The string `'create-new'` if the user chose to create a new wallet for this login method.
 * - The string `'abort-signup'` if the user chose to abort the sign-up process (no wallet is created; the client may call `login` to log in to an existing wallet).
 */
export type WalletSelectionUiHandler = (options: WalletSelectionOptions) => Promise<'create-new' | 'abort-signup'>
