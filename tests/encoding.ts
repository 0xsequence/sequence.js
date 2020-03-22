import { promises as fs } from 'fs'
import Contract from '../src'
import { Wallet } from 'ethers'
import { expect } from 'chai'

let abi
const signer = Wallet.fromMnemonic(
  'dose weasel clever culture letter volume endorse used harvest ripple circle install'
)

async function readFixturesFile(path: string): Promise<string> {
  return (await fs.readFile('./tests/fixtures/' + path)).toString()
}

before(async () => {
  abi = await readFixturesFile('meta_erc1155.json')
})

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
  const data = JSON.parse(await readFixturesFile(function_name + '.json'))

  for (const name in data) {
    const test = data[name]

    // the first param of the meta-transaction is always the account
    // that signs the transaction.
    const params = test.params
    params.unshift(signer.address)

    const contract = new Contract(JSON.stringify(metaErc1155ABI), test.contract)
    const result = await contract.call(test.opts, signer, function_name, params)

    expect(result).to.equal(test.result)
  }
}
