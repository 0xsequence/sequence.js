import { TokenEncoder } from '../src/tokens/encoder'
import { Wallet } from 'ethers'
import { MethodTypes } from '../src/tokens/types'

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

    const encoder = new TokenEncoder(test.contract, signer)

    const result = await encoder.encode(
      {
        type: function_name,
        params: test.params
      },
      test.opts
    )

    expect(result).toEqual(test.result)
  }
}
