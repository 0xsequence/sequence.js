import { Address } from 'ox'
import { Signers } from '@0xsequence/wallet-core'
import { Extensions } from '@0xsequence/wallet-primitives'
import type { Shared } from './manager.js'

/**
 * Optimized passkey login that reduces user interactions from 2 to 1
 * by using the credential database instead of the discovery flow
 */
export class PasskeyLoginOptimizer {
  constructor(private readonly shared: Shared) {}

  async loginWithStoredCredentials(selectWallet: (wallets: Address.Address[]) => Promise<Address.Address>): Promise<{
    selectedWallet: Address.Address
    passkeySigner: Signers.Passkey.Passkey
  }> {
    // Step 1: Get available credentials from database (no user interaction)
    const credentials = await this.shared.databases.passkeyCredentials.list()

    if (credentials.length === 0) {
      throw new Error('no-passkey-credentials-found')
    }

    // Step 2: Let user select wallet (UI interaction, not WebAuthn)
    const availableWallets = credentials.map((c) => c.walletAddress)
    const selectedWallet = availableWallets.length === 1 ? availableWallets[0]! : await selectWallet(availableWallets)

    // Step 3: Find the credential for the selected wallet
    const selectedCredential = credentials.find((c) => Address.isEqual(c.walletAddress, selectedWallet))

    if (!selectedCredential) {
      throw new Error('wallet-not-found-in-credentials')
    }

    const passkeySigner = new Signers.Passkey.Passkey({
      credentialId: selectedCredential.credentialId,
      publicKey: selectedCredential.publicKey,
      extensions: this.shared.sequence.extensions,
      embedMetadata: false,
      metadata: { credentialId: selectedCredential.credentialId },
    })

    return {
      selectedWallet,
      passkeySigner,
    }
  }
}
