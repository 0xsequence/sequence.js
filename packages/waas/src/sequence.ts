import { ethers } from "ethers"
import { SessionPayload, SessionReceipt, openSession } from "./payloads/session"
import { Store, StoreObj } from "./store"
import { TransactionsPayload, sendTransactions } from "./payloads/wallet"

type status = 'pending' | 'signed-in' | 'signed-out'

const SEQUENCE_WAAS_WALLET_KEY = '@0xsequence.waas.wallet'
const SEQUENCE_WAAS_SIGNER_KEY = '@0xsequence.waas.signer'
const SEQUENCE_WAAS_STATUS_KEY = '@0xsequence.waas.status'

export class Sequence {
  private readonly status = new StoreObj<status>(this.store, SEQUENCE_WAAS_STATUS_KEY, 'signed-out')
  private readonly signer = new StoreObj<string | undefined>(this.store, SEQUENCE_WAAS_SIGNER_KEY, undefined)
  private readonly wallet = new StoreObj<string | undefined>(this.store, SEQUENCE_WAAS_WALLET_KEY, undefined)

  constructor (
    private readonly store: Store,
  ) {}

  /**
   * This method will initiate a sign-in process with the waas API. It must be performed
   * when the user wants to sign in to the app, in parallel with the authentication of the
   * application's own authentication system.
   * 
   * This method begins the sign-in process, but does not complete it. The returned payload
   * must be sent to the waas API to complete the sign-in. The waas API will return a receipt
   * that must be sent to the `completeSignIn` method to complete the sign-in. 
   * 
   * @param proof Information about the user that can be used to prove their identity
   * @returns a session payload that **must** be sent to the waas API to complete the sign-in
   * @throws {Error} If the session is already signed in or there is a pending sign-in
   */
  async signIn(): Promise<SessionPayload> {
    const status = await this.status.get()
    if (status !== 'signed-out') {
      throw new Error(status === 'pending' ? 'Pending sign in' : 'Already signed in')
    }

    const result = await openSession()

    await Promise.all([
      this.status.set('signed-in'),
      this.signer.set(result.signer.privateKey)
    ])

    return result.payload
  }

  /**
   * This method will complete a sign-in process with the waas API. It must be performed
   * after the `signIn` method, when the waas API has returned a receipt.
   * 
   * This method completes the sign-in process by validating the receipt's proof.
   * If the proof is invalid or there is no pending sign-in, it will throw an error.
   * 
   * After this method is called, the wallet is ready to be used to sign transactions.
   * 
   * @param receipt The receipt returned by the waas API after the `signIn` method
   * @returns The wallet address of the user that signed in
   * @throws {Error} If there is no pending sign-in or the receipt is invalid
   */
  async completeSignIn(receipt: SessionReceipt) {
    const status = await this.status.get()
    const signerPk = await this.signer.get()

    if (status !== 'pending' || !signerPk) {
      throw new Error('No pending sign in')
    }

    const signer = new ethers.Wallet(signerPk)
    if (signer.address !== receipt.signer) {
      throw new Error('Invalid signer')
    }

    await Promise.all([
      this.status.set('signed-in'),
      this.signer.set(receipt.wallet)
    ])

    return receipt.wallet
  }

  async isSignedIn() {
    const status = await this.status.get()
    return status === 'signed-in'
  }

  //
  // Signer methods
  //

  /**
   * This method can be used to send transactions to the waas API. It can only be used
   * after successfully signing in with the `signIn` and `completeSignIn` methods.
   * 
   * The method does not send the transactions to the network. It only returns a payload
   * that must be sent to the waas API to complete the transaction.
   * 
   * @param transactions The transactions to be sent
   * @param chainId The network on which the transactions will be sent
   * @returns a payload that must be sent to the waas API to complete the transaction
   */
  async sendTransactions(
    transactions: ethers.providers.TransactionRequest[],
    chainId: number
  ): Promise<TransactionsPayload> {
    if (!(await this.isSignedIn())) {
      throw new Error('Not signed in')
    }

    const signerPk = await this.signer.get()
    if (!signerPk) {
      throw new Error('No signer')
    }

    const wallet = await this.wallet.get()
    if (!wallet) {
      throw new Error('No wallet')
    }

    const signer = new ethers.Wallet(signerPk)
    return sendTransactions(signer, wallet, transactions, chainId)
  }
}
