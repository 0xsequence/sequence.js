import { MessageToSign, WalletUserPrompter } from '@0xsequence/provider'

export class MockWalletUserPrompter implements WalletUserPrompter {
  autoConfirm: boolean

  constructor(autoConfirm: boolean = false) {
    this.autoConfirm = autoConfirm
  }

  promptSignMessage = async (message: MessageToSign): Promise<string> => {
    // TODO: add failure case here, for message that user will decline..

    // return this.autoConfirm
    return ''
  }

  promptSendTransaction = async (txnParams: any, chaindId?: number): Promise<string> => {
    // TODO: we actually need the app to do this..
    // for test, we can make this in our wallet.ts test, and pass the wallet, etc..
    return ''
  }
}
