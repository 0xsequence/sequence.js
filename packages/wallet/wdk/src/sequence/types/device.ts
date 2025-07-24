/**
 * Represents a device key that is authorized to sign for a wallet.
 */
export interface Device {
  /**
   * The on-chain address of the device key.
   */
  address: Address.Checksummed

  /**
   * True if this is the key for the current local session.
   * This is useful for UI to distinguish the active device from others and to exclude from remote logout if true.
   */
  isLocal: boolean
}
