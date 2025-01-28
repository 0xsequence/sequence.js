import { Configuration, hash, hashConfiguration, Payload } from '@0xsequence/sequence-primitives'
import { Address, Bytes, Hex } from 'ox'
import { Signature, StateReader, StateWriter } from '.'
import * as service from './sessions.gen'

export class Sessions implements StateReader, StateWriter {
  private sessions: service.Sessions

  constructor(readonly host = 'https://sessions.sequence.app') {
    this.sessions = new service.Sessions(host, fetch)
  }

  async getConfiguration(imageHash: Hex.Hex): Promise<Configuration> {
    const { version, config } = await this.sessions.config({ imageHash })

    if (version !== 3) {
      throw new Error(`v${version} configuration ${imageHash}, only v3 is supported`)
    }

    return config
  }

  async getDeployHash(wallet: Address.Address): Promise<Hex.Hex> {
    const { deployHash } = await this.sessions.deployHash({ wallet })

    Hex.assert(deployHash)

    return deployHash
  }

  async getWallets(
    signer: Address.Address,
  ): Promise<Array<{ wallet: Address.Address; chainId: bigint; digest: Hex.Hex; signature: Signature }>> {
    const { wallets } = await this.sessions.wallets({ signer })

    return Object.entries(wallets).map(
      ([wallet, { chainID: chainId, digest, signature, type, validOnChain, validOnBlock }]) => {
        Address.assert(wallet)
        Hex.assert(digest)
        Hex.assert(signature)

        switch (type) {
          case service.SignatureType.EIP712:
            return { wallet, chainId: BigInt(chainId), digest, signature: { type: 'eip-712', signature } }

          case service.SignatureType.EthSign:
            return { wallet, chainId: BigInt(chainId), digest, signature: { type: 'eth_sign', signature } }

          case service.SignatureType.EIP1271:
            return {
              wallet,
              chainId: BigInt(chainId),
              digest,
              signature: {
                type: 'erc-1271',
                signature,
                validAt: {
                  chainId: validOnChain ? BigInt(validOnChain) : (undefined as any),
                  block: validOnBlock ? Number(validOnBlock) : (undefined as any),
                },
              },
            }
        }
      },
    )
  }

  async getConfigurationPath(
    wallet: Address.Address,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): Promise<Array<{ imageHash: Hex.Hex; signature: Hex.Hex }>> {
    const { updates } = await this.sessions.configUpdates({ wallet, fromImageHash, allUpdates: options?.allUpdates })

    return updates.map(({ toImageHash: imageHash, signature }) => {
      Hex.assert(imageHash)
      Hex.assert(signature)

      return { imageHash, signature }
    })
  }

  async saveWallet(deployConfiguration: Configuration): Promise<void> {
    await this.sessions.saveWallet({ version: 3, deployConfig: deployConfiguration })
  }

  async saveWitness(
    signer: Address.Address,
    wallet: Address.Address,
    chainId: bigint,
    payload: Payload,
    signature: Signature<number | undefined>,
  ): Promise<void> {
    await this.sessions.saveSignerSignatures2({
      wallet,
      chainID: `${chainId}`,
      digest: Bytes.toHex(hash(wallet, chainId, payload)),
      signatures: [
        {
          signer,
          signature: signature.signature,
          referenceChainID: signature.type === 'erc-1271' ? `${signature.validAt.chainId}` : undefined,
        },
      ],
    })
  }

  async setConfiguration(wallet: Address.Address, configuration: Configuration, signature: Hex.Hex): Promise<void> {
    await this.sessions.saveSignature({
      wallet,
      chainID: '0',
      digest: Bytes.toHex(
        hash(wallet, 0n, { type: 'config-update', imageHash: Bytes.toHex(hashConfiguration(configuration)) }),
      ),
      signature,
      toConfig: configuration,
    })
  }
}
