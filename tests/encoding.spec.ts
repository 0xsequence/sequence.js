import { ERC1155MetaEncoder } from '../src'
import { Wallet } from 'ethers'
import { MethodTypes } from '../src/types'

const signer = Wallet.fromMnemonic(
  'dose weasel clever culture letter volume endorse used harvest ripple circle install'
)

describe('MetaTransactions', () => {
  it('metaSafeBatchTransferFrom', async () => {
    await execTest('metaSafeBatchTransferFrom')
  })
  it('metaSafeTransferFrom', async () => {
    await execTest('metaSafeTransferFrom')
  })
  it('metaSetApproval', async () => {
    await execTest('metaSetApprovalForAll')
  })
})

const execTest = async (function_name: MethodTypes) => {
  const { default: data } = await import(`./fixtures/${function_name}.json`)

  for (const name of Object.keys(data)) {
    const test = data[name]

    // the first param of the meta-transaction is always the account
    // that signs the transaction.
    const params = [signer.address, ...test.params]

    const encoder = new ERC1155MetaEncoder(test.contract)
    const result = await encoder.encode(
      function_name,
      signer,
      test.opts,
      params
    )

    expect(result).toEqual(test.result)
  }
}
