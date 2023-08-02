import { ethers } from 'ethers'

import { CallReceiverMock } from '@0xsequence/wallet-contracts'
import { OverwriterEstimator } from '@0xsequence/estimator'
import { encodeData } from '@0xsequence/wallet/tests/utils'
import { expect } from 'chai'

const CallReceiverMockArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/mocks/CallReceiverMock.sol/CallReceiverMock.json')

describe('estimator', function () {
  let url: string
  let provider: ethers.providers.JsonRpcProvider
  let callReceiver: CallReceiverMock

  let estimator: OverwriterEstimator

  before(async () => {
    url = 'http://127.0.0.1:10045/'
    provider = new ethers.providers.JsonRpcProvider(url)

    callReceiver = (await new ethers.ContractFactory(
      CallReceiverMockArtifact.abi,
      CallReceiverMockArtifact.bytecode,
      provider.getSigner()
    ).deploy()) as unknown as CallReceiverMock

    estimator = new OverwriterEstimator({ rpc: url })
  })

  beforeEach(async () => {
    await callReceiver.setRevertFlag(false)
    await callReceiver.testCall(0, [])
  })

  it('should estimate the gas of a single call', async () => {
    const gas = await estimator.estimate({
      to: callReceiver.address,
      data: await encodeData(callReceiver, 'testCall', 1, '0x112233')
    })
    const tx = await (await callReceiver.testCall(1, '0x112233')).wait()
    expect(gas.toNumber()).to.be.above(tx.gasUsed.toNumber())
    expect(gas.toNumber()).to.be.approximately(tx.gasUsed.toNumber(), 5000)
  })
})
