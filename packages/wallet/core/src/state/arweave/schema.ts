import { Address, Hex } from 'ox'

type ConfigTags = {
  Type: 'config'
  'Major-Version': number
  'Minor-Version': number
  'Content-Type': 'application/json'
  Config: Hex.Hex
  Version: number
  Complete: boolean
  'Signers-Count': number
  'Signers-Bloom': Hex.Hex
}

type TreeTags = {
  Type: 'tree'
  'Major-Version': number
  'Minor-Version': number
  'Content-Type': 'application/json'
  Tree: Hex.Hex
  Complete: boolean
}

type WalletTags = {
  Type: 'wallet'
  'Minor-Version': number
  'Content-Type': 'application/json'
  Wallet: Address.Address
  'Deploy-Config': Hex.Hex
  'Deploy-Version': number
  'Deploy-Config-Attached': boolean
  'Deploy-Config-Complete': boolean
  'Deploy-Signers-Count': number
  'Deploy-Signers-Bloom': Hex.Hex
} & (
  { 'Major-Version': 1 } |
  { 'Major-Version': 2; Context: ContextTags }
)

type ContextTags = {
  Factory: Address.Address
  'Stage-1': Address.Address
  'Stage-2': Address.Address
  Guest: Address.Address
  'Creation-Code': Hex.Hex
}

type PayloadTags = {
  Type: 'payload'
  'Major-Version': number
  'Minor-Version': number
  'Content-Type': 'application/json'
  Payload: Hex.Hex
}

type CallsPayloadTags = PayloadTags & {
  'Payload-Type': 'calls'
  Space: bigint
  Nonce: bigint
}

type MessagePayloadTags = PayloadTags & {
  'Payload-Type': 'message'
}

type ConfigUpdatePayloadTags = PayloadTags & {
  'Payload-Type': 'config update'
  'To-Config': Hex.Hex
  'To-Version': number
  'To-Checkpoint': bigint
  'To-Config-Complete': boolean
  'To-Signers-Count': number
  'To-Signers-Bloom': Hex.Hex
}

type DigestPayloadTags = PayloadTags & {
  'Payload-Type': 'digest'
  Digest: Hex.Hex
}

function assertConfigTags(tags: { [tag: string]: string }): ConfigTags {
  return {
    Type: assertString(tags.Type, 'config'),
    'Major-Version': assertInteger(tags['Major-Version']),
    'Minor-Version': assertInteger(tags['Minor-Version']),
    'Content-Type': assertString(tags['Content-Type'], 'application/json'),
    Config: assertHex(tags.Config),
    Version: assertInteger(tags.Version),
    Complete: assertBoolean(tags.Complete),
    'Signers-Count': assertInteger(tags['Signers-Count']),
    'Signers-Bloom': assertHex(tags['Signers-Bloom']),
  }
}

function assertTreeTags(tags: { [tag: string]: string }): TreeTags {
  return {
    Type: assertString(tags.Type, 'tree'),
    'Major-Version': assertInteger(tags['Major-Version']),
    'Minor-Version': assertInteger(tags['Minor-Version']),
    'Content-Type': assertString(tags['Content-Type'], 'application/json'),
    Tree: assertHex(tags.Tree),
    Complete: assertBoolean(tags.Complete),
  }
}

function assertWalletTags(tags: { [tag: string]: string }): WalletTags {
  const majorVersion = assertInteger(tags['Major-Version'])

  switch (majorVersion) {
    case 1:
      return {
        Type: assertString(tags.Type, 'wallet'),
        'Major-Version': majorVersion,
        'Minor-Version': assertInteger(tags['Minor-Version']),
        'Content-Type': assertString(tags['Content-Type'], 'application/json'),
        Wallet: assertAddress(tags.Wallet),
        'Deploy-Config': assertHex(tags['Deploy-Config']),
        'Deploy-Version': assertInteger(tags['Deploy-Version']),
        'Deploy-Config-Attached': assertBoolean(tags['Deploy-Config-Attached']),
        'Deploy-Config-Complete': assertBoolean(tags['Deploy-Config-Complete']),
        'Deploy-Signers-Count': assertInteger(tags['Deploy-Signers-Count']),
        'Deploy-Signers-Bloom': assertHex(tags['Deploy-Signers-Bloom']),
      }

    case 2:
      return {
        Type: assertString(tags.Type, 'wallet'),
        'Major-Version': majorVersion,
        'Minor-Version': assertInteger(tags['Minor-Version']),
        'Content-Type': assertString(tags['Content-Type'], 'application/json'),
        Wallet: assertAddress(tags.Wallet),
        'Deploy-Config': assertHex(tags['Deploy-Config']),
        'Deploy-Version': assertInteger(tags['Deploy-Version']),
        'Deploy-Config-Attached': assertBoolean(tags['Deploy-Config-Attached']),
        'Deploy-Config-Complete': assertBoolean(tags['Deploy-Config-Complete']),
        'Deploy-Signers-Count': assertInteger(tags['Deploy-Signers-Count']),
        'Deploy-Signers-Bloom': assertHex(tags['Deploy-Signers-Bloom']),
        Context: assertContextTags(tags),
      }

    default:
      throw new Error(`unknown wallet major version ${majorVersion}`)
  }

}

function assertContextTags(tags: { [tag: string]: string }): ContextTags {
  return {
    Factory: assertAddress(tags['Context-Factory']),
    'Stage-1': assertAddress(tags['Context-Stage-1']),
    'Stage-2': assertAddress(tags['Context-Stage-2']),
    Guest: assertAddress(tags['Context-Guest']),
    'Creation-Code': assertHex(tags['Context-Creation-Code']),
  }
}

function assertPayloadTags(tags: { [tag: string]: string }): PayloadTags {
}

function assertCallsPayloadTags(tags: { [tag: string]: string }): CallsPayloadTags {
}

function assertMessagePayloadTags(tags: { [tag: string]: string }): MessagePayloadTags {
}

function assertConfigUpdatePayloadTags(tags: { [tag: string]: string }): ConfigUpdatePayloadTags {
}

function assertDigestPayloadTags(tags: { [tag: string]: string }): DigestPayloadTags {
}

function assertAddress(value: string | undefined): Address.Address {
  switch (typeof value) {
    case 'string':
      Address.assert(value)
      break
    default:
      throw new Error(`${value} is not an address`)
  }
  return value
}

function assertHex(value: string | undefined): Hex.Hex {
  Hex.assert(value)
  return value
}

function assertString<T extends string>(value: string | undefined, literal: T): T {
  switch (value) {
    case literal:
      return value as T
    default:
      throw new Error(`'${value}', expected '${literal}'`)
  }
}

function assertInteger(value: string | undefined): number {
  if (value === undefined) {
    throw new Error('undefined is not an integer')
  }

  if (!/^-?\d+$/.test(value)) {
    throw new Error(`${value} is not an integer`)
  }

  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${value} is not an integer`)
  }

  return parsed
}

function assertBoolean(value: string | undefined): boolean {
  switch (value) {
    case 'true':
      return true
    case 'false':
      return false
    default:
      throw new Error(`${value} is not a boolean`)
  }
}
