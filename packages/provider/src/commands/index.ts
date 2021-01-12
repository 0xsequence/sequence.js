import { WalletProvider } from '../wallet'

export class WalletCommands {
  private wallet: WalletProvider

  constructor(walletProvider: WalletProvider) {
    this.wallet = walletProvider
  }

  // TODO..
  signMessage() {
  }

  // TODO
  signAuthMessage() {
  }

  // signTypedData()

  // sendTransaction()
  // sendTransactions()

  // sendETH()
  // sendToken()
  // sendCoin() -- sugar for sendToken()
  // sendCollectible() -- sugar for sendToken()
  // callContract()

  // transactionHistory()
  // getReceipt()
  // getLogs()
  // // ..

  // isWalletDeployed()
  // deployWallet()

  // validateSignature()
  // recoverWalletConfig()
  // recoverAddress()
}
