
import hardhat from 'hardhat'
import * as chai from 'chai'

import { v1, v2 } from "@0xsequence/core"
import { context } from "@0xsequence/tests"
import { ethers } from 'ethers'
import { Wallet } from '../src/index'
import { Orchestrator, signers as hubsigners } from '@0xsequence/signhub'
import { LocalRelayer } from '@0xsequence/relayer'

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
        const signer = ethers.Wallet.createRandom()

        const config = coders.config.fromSimple({
          threshold: 1,
          checkpoint: 0,
          signers: [{ address: signer.address, weight: 1 }]
        })

        const wallet = Wallet.newWallet({
          coders: coders as any,
          context: contexts[version],
          config,
          orchestrator: new Orchestrator([new hubsigners.SignerWrapper(signer)]),
          chainId: provider.network.chainId,
          provider
        })

        const deployTx = wallet.buildDeployTransaction()
        await relayer.relay({ ...deployTx, chainId: provider.network.chainId, intent: {
            digest: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
            wallet: wallet.address
          }
        })

        expect(await wallet.reader().isDeployed()).to.be.true
      });

      ([{
        name: 'After deployment',
        setup: async (wallet: Wallet) => {
          const deployTx = wallet.buildDeployTransaction()
          await relayer.relay({ ...deployTx, chainId: provider.network.chainId, intent: {
              digest: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
              wallet: wallet.address
            }
          })
        }
      }, {
        name: 'Before deployment',
        setup: async (_: Wallet) => { }
      }]).map(({ name, setup }) => {
        describe(name, () => {
          let wallet: Wallet

          beforeEach(async () => {
            const signer = ethers.Wallet.createRandom()

            const config = coders.config.fromSimple({
              threshold: 1,
              checkpoint: 0,
              signers: [{ address: signer.address, weight: 1 }]
            })
    
            wallet = Wallet.newWallet({
              coders: coders as any,
              context: contexts[version],
              config,
              orchestrator: new Orchestrator([new hubsigners.SignerWrapper(signer)]),
              chainId: provider.network.chainId,
              provider,
              relayer
            }) as any as Wallet

            await setup(wallet)
          })

          it('Should send an empty list of transactions', async () => {
            await wallet.sendTransaction([])
          })

          it('Should send a transaction with an empty call', async () => {
            await wallet.sendTransaction([{
              to: ethers.Wallet.createRandom().address
            }])
          })
        })
      })
    })
  })
})
