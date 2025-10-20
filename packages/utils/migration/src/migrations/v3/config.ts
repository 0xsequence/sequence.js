import {
  Config as V3Config,
  Extensions as V3Extensions,
  GenericTree as V3GenericTree,
  SessionConfig as V3SessionConfig,
} from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'

export const createDefaultV3Topology = (
  loginSigner: {
    address: Address.Address
    imageHash?: Hex.Hex
  },
  extensions?: V3Extensions.Extensions,
): V3Config.Topology => {
  // Login topology
  const loginTopology: V3Config.SapientSignerLeaf | V3Config.SignerLeaf = loginSigner.imageHash
    ? {
        type: 'sapient-signer',
        address: loginSigner.address,
        weight: 1n,
        imageHash: loginSigner.imageHash,
      }
    : {
        type: 'signer',
        address: loginSigner.address,
        weight: 1n,
      }
  // Wallet guard topology
  const walletGuardTopology: V3Config.SignerLeaf = {
    type: 'signer',
    address: '0xa2e70CeaB3Eb145F32d110383B75B330fA4e288a', // Guard wallet signer
    weight: 1n,
  }
  // Placeholder recovery topology
  const recoveryTopology: V3Config.SapientSignerLeaf = {
    type: 'sapient-signer',
    address: (extensions ?? V3Extensions.Rc3).recovery,
    weight: 255n,
    imageHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  }
  // Session topology
  let sessionsImageHash: Hex.Hex = '0x0000000000000000000000000000000000000000000000000000000000000000'
  if (!loginSigner.imageHash) {
    // We can't use the login signer with sessions if it is a sapient signer
    const sessionsTopology = V3SessionConfig.emptySessionsTopology(loginSigner.address)
    const sessionsConfig = V3SessionConfig.sessionsTopologyToConfigurationTree(sessionsTopology)
    sessionsImageHash = V3GenericTree.hash(sessionsConfig)
  }
  const sessionTopology: V3Config.SapientSignerLeaf = {
    type: 'sapient-signer',
    address: (extensions ?? V3Extensions.Rc3).sessions,
    weight: 1n,
    imageHash: sessionsImageHash,
  }
  // Sessions are protected by a guard signer
  const sessionGuardTopology: V3Config.SignerLeaf = {
    type: 'signer',
    address: '0x18002Fc09deF9A47437cc64e270843dE094f5984', // Guard session signer
    weight: 1n,
  }
  const nestedSessionTopology: V3Config.NestedLeaf = {
    type: 'nested',
    weight: 255n,
    threshold: 2n,
    tree: [sessionTopology, sessionGuardTopology],
  }
  // Return the wallet topology
  return [
    [loginTopology, walletGuardTopology],
    [recoveryTopology, nestedSessionTopology],
  ]
}
