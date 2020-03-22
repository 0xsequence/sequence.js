import { Contract } from '../src'
import { Wallet } from 'ethers'
import meta_erc1155 from './fixtures/meta_erc1155.json'

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

async function execTest(function_name: string) {
  const { default: data } = await import(`./fixtures/${function_name}.json`)

  for (const name of Object.keys(data)) {
    const test = data[name]

    // the first param of the meta-transaction is always the account
    // that signs the transaction.
    const params = [signer.address, ...test.params]

    const contract = new Contract(meta_erc1155, test.contract)
    const result = await contract.call(test.opts, signer, function_name, params)

    expect(result).toEqual(test.result)
  }
}
