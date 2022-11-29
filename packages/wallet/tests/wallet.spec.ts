
import hardhat from 'hardhat'
import * as chai from 'chai'

import { v1, v2, commons } from "@0xsequence/core"
import { context } from "@0xsequence/tests"
import { ethers } from 'ethers'
import { Wallet } from '../src/index'
import { Orchestrator, signers as hubsigners } from '@0xsequence/signhub'
import { LocalRelayer } from '@0xsequence/relayer'
import { subDigestOf } from '@0xsequence/utils'

const { expect } = chai

describe('Wallet (primitive)', () => {
  let provider: ethers.providers.Web3Provider
  let signers: ethers.Signer[]

  let contexts: Awaited<ReturnType<typeof context.deploySequenceContexts>>
  let relayer: LocalRelayer

  before(async () => {
    provider = new ethers.providers.Web3Provider(hardhat.network.provider.send)
    signers = new Array(8).fill(0).map((_, i) => provider.getSigner(i))
    contexts = await context.deploySequenceContexts(signers[0])
    relayer = new LocalRelayer(signers[1])
  });

  ([{
    version: 1,
    coders: { signature: v1.signature.SignatureCoder, config: v1.config.ConfigCoder },
  }, {
    version: 2,
    coders: { signature: v2.signature.SignatureCoder, config: v2.config.ConfigCoder },
  }]).map(({ version, coders }) => {
    describe(`Using v${version} version`, () => {
      it('Should deploy a new wallet', async () => {
        const signer = new ethers.Wallet('0xd621cdee0f5776495d8cfe2700c2e327199a07660600971b9f3f305d502824c3')

        const config = coders.config.fromSimple({ threshold: 1, checkpoint: 0, signers: [{ address: signer.address, weight: 1 }] })
        const address = commons.context.addressOf(contexts[version], coders.config.imageHashOf(config as any))

        const wallet = new Wallet({
          coders: coders as any,
          context: contexts[version],
          config,
          address,
          orchestrator: new Orchestrator([new hubsigners.SignerWrapper(signer)]),
          chainId: provider.network.chainId
        })

        wallet.connect(provider, relayer)

        await wallet.sendTransaction([{
          to: '0x1bfb63F428E33Ec8561e3Bd6b78bDc3290b79CC4',
          revertOnError: true
        }])

        expect(await wallet.reader().isDeployed()).to.be.true
      })
    })
  })
})
