
import { promises as fs } from "fs";
import Contract from '../src'
import { Wallet } from 'ethers'
import { expect } from 'chai';
import metaErc1155ABI from './fixtures/meta_erc1155.json'

let signer = Wallet.fromMnemonic("dose weasel clever culture letter volume endorse used harvest ripple circle install")

async function readFixturesFile(path: string): Promise<string> {
  return (await fs.readFile('./tests/fixtures/' + path)).toString()
}

describe('MetaTransactions', () => {
  it('metaSafeBatchTransferFrom', async () => {
    await execTest("metaSafeBatchTransferFrom")
  })
  it('metaSafeTransferFrom', async() => {
    await execTest("metaSafeTransferFrom")
  })
  it('metaSetApproval', async() => {
    await execTest("metaSetApprovalForAll")
  })
});

async function execTest(function_name: string) {
  let data = JSON.parse(await readFixturesFile(function_name + ".json"))

  for (const name in data) {
    const test = data[name]

    // the first param of the meta-transaction is always the account 
    // that signs the transaction.
    const params = test.params
    params.unshift(signer.address)

    const contract = new Contract(JSON.stringify(metaErc1155ABI), test.contract)
    const result = await contract.call(test.opts, signer, function_name, params)

    expect(result).to.equal(test.result);
  }
}
