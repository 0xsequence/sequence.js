import { Address, Hex } from 'ox'

export type BooleanString = 'true' | 'false'
export type IntegerString = `${number}`
export type ConfigVersion = '1' | '2' | '3'
export type WalletMajorVersion = '1' | '2'
export type PayloadType = 'calls' | 'message' | 'config update' | 'digest'
export type SignatureType = 'eip-712' | 'eth_sign' | 'erc-1271' | 'sapient' | 'sapient-compact'
export type BehaviorOnError = 'ignore' | 'revert' | 'abort'

export interface V1ConfigSignerData {
  weight: number
  address: Address.Address
}

export interface V1ConfigData {
  threshold: number
  signers: Array<V1ConfigSignerData>
}

export interface V2ConfigAddressLeafData {
  weight: number
  address: Address.Address
}

export interface V2ConfigNestedLeafData {
  weight: number
  threshold: number
  tree: V2ConfigTreeData
}

export interface V2ConfigSubdigestLeafData {
  subdigest: Hex.Hex
}

export type V2ConfigTreeData =
  | Hex.Hex
  | [V2ConfigTreeData, V2ConfigTreeData]
  | V2ConfigAddressLeafData
  | V2ConfigNestedLeafData
  | V2ConfigSubdigestLeafData

export interface V2ConfigData {
  threshold: number
  checkpoint: number
  tree: V2ConfigTreeData
}

export interface V3ConfigAddressLeafData {
  weight: number
  address: Address.Address
}

export interface V3ConfigSapientSignerLeafData {
  weight: number
  address: Address.Address
  imageHash: Hex.Hex
}

export interface V3ConfigNestedLeafData {
  weight: number
  threshold: number
  tree: V3ConfigTreeData
}

export interface V3ConfigSubdigestLeafData {
  subdigest: Hex.Hex
}

export interface V3ConfigAnyAddressSubdigestLeafData {
  subdigest: Hex.Hex
  isAnyAddress: true
}

export type V3ConfigTreeData =
  | Hex.Hex
  | [V3ConfigTreeData, V3ConfigTreeData]
  | V3ConfigAddressLeafData
  | V3ConfigSapientSignerLeafData
  | V3ConfigNestedLeafData
  | V3ConfigSubdigestLeafData
  | V3ConfigAnyAddressSubdigestLeafData

export interface V3ConfigData {
  threshold: number
  checkpoint: IntegerString
  tree: V3ConfigTreeData
  checkpointer?: Address.Address
}

export type ConfigData = V1ConfigData | V2ConfigData | V3ConfigData

export interface TreeLeafData {
  data: Hex.Hex
}

export type TreeData = Hex.Hex | TreeLeafData | Array<TreeData>

export interface CallData {
  to: Address.Address
  value: IntegerString
  data: Hex.Hex
  gasLimit: IntegerString
  delegateCall: boolean
  onlyFallback: boolean
  behaviorOnError: BehaviorOnError
}

export interface ArweaveRecordBase<
  TType extends string,
  TMajorVersion extends string,
  TMinorVersion extends string,
  TContentType extends string,
> {
  Type: TType
  'Major-Version': TMajorVersion
  'Minor-Version': TMinorVersion
  'Content-Type': TContentType
}

export interface ArweaveConfigRecordBase extends ArweaveRecordBase<'config', '1', '0', 'application/json'> {
  Config: Hex.Hex
  Complete: BooleanString
  'Signers-Count': IntegerString
  'Signers-Bloom': Hex.Hex
}

export interface ArweaveV1ConfigRecord extends ArweaveConfigRecordBase {
  Version: '1'
  data: V1ConfigData
}

export interface ArweaveV2ConfigRecord extends ArweaveConfigRecordBase {
  Version: '2'
  data: V2ConfigData
}

export interface ArweaveV3ConfigRecord extends ArweaveConfigRecordBase {
  Version: '3'
  data: V3ConfigData
}

export type ArweaveConfigRecord = ArweaveV1ConfigRecord | ArweaveV2ConfigRecord | ArweaveV3ConfigRecord

export interface ArweaveTreeRecord extends ArweaveRecordBase<'tree', '1', '0', 'application/json'> {
  Tree: Hex.Hex
  Complete: BooleanString
  data: TreeData
}

export interface ArweaveWalletRecordBase extends ArweaveRecordBase<
  'wallet',
  WalletMajorVersion,
  '0',
  'application/json'
> {
  Wallet: Address.Address
  'Deploy-Config': Hex.Hex
  'Deploy-Version': ConfigVersion
  'Deploy-Config-Attached': BooleanString
  'Deploy-Config-Complete': BooleanString
  'Deploy-Signers-Count': IntegerString
  'Deploy-Signers-Bloom': Hex.Hex
}

export interface ArweaveWalletDefaultContext {
  'Major-Version': '1'
}

export interface ArweaveWalletCustomContext {
  'Major-Version': '2'
  'Context-Factory': Address.Address
  'Context-Stage-1': Address.Address
  'Context-Stage-2': Address.Address
  'Context-Guest': Address.Address
  'Context-Creation-Code': Hex.Hex
}

export interface ArweaveWalletDetachedData {
  'Deploy-Config-Attached': 'false'
  'Deploy-Config-Complete': 'false'
  data: null
}

export interface ArweaveWalletWithV1DeployConfig {
  'Deploy-Config-Attached': 'true'
  'Deploy-Version': '1'
  data: V1ConfigData
}

export interface ArweaveWalletWithV2DeployConfig {
  'Deploy-Config-Attached': 'true'
  'Deploy-Version': '2'
  data: V2ConfigData
}

export interface ArweaveWalletWithV3DeployConfig {
  'Deploy-Config-Attached': 'true'
  'Deploy-Version': '3'
  data: V3ConfigData
}

export type ArweaveWalletRecord = ArweaveWalletRecordBase &
  (ArweaveWalletDefaultContext | ArweaveWalletCustomContext) &
  (
    | ArweaveWalletDetachedData
    | ArweaveWalletWithV1DeployConfig
    | ArweaveWalletWithV2DeployConfig
    | ArweaveWalletWithV3DeployConfig
  )

export interface ArweavePayloadRecordBase extends ArweaveRecordBase<'payload', '1', '2', 'application/json'> {
  Payload: Hex.Hex
  Address: Address.Address
  'Chain-ID': IntegerString
  'Payload-Type': PayloadType
}

export interface ArweaveCallsPayloadRecord extends ArweavePayloadRecordBase {
  'Payload-Type': 'calls'
  Space: IntegerString
  Nonce: IntegerString
  data: Array<CallData>
}

export interface ArweaveMessagePayloadRecord extends ArweavePayloadRecordBase {
  'Payload-Type': 'message'
  data: Hex.Hex
}

export interface ArweaveConfigUpdatePayloadRecordBase extends ArweavePayloadRecordBase {
  'Payload-Type': 'config update'
  'To-Config': Hex.Hex
  'To-Checkpoint': IntegerString
  'To-Config-Complete': BooleanString
  'To-Signers-Count': IntegerString
  'To-Signers-Bloom': Hex.Hex
}

export interface ArweaveV1ConfigUpdatePayloadRecord extends ArweaveConfigUpdatePayloadRecordBase {
  'To-Version': '1'
  data: V1ConfigData
}

export interface ArweaveV2ConfigUpdatePayloadRecord extends ArweaveConfigUpdatePayloadRecordBase {
  'To-Version': '2'
  data: V2ConfigData
}

export interface ArweaveV3ConfigUpdatePayloadRecord extends ArweaveConfigUpdatePayloadRecordBase {
  'To-Version': '3'
  data: V3ConfigData
}

export interface ArweaveDigestPayloadRecord extends ArweavePayloadRecordBase {
  'Payload-Type': 'digest'
  Digest: Hex.Hex
  data: null
}

export type ArweavePayloadRecord =
  | ArweaveCallsPayloadRecord
  | ArweaveMessagePayloadRecord
  | ArweaveV1ConfigUpdatePayloadRecord
  | ArweaveV2ConfigUpdatePayloadRecord
  | ArweaveV3ConfigUpdatePayloadRecord
  | ArweaveDigestPayloadRecord

export interface ArweaveConfigUpdateTags {
  Type: 'config update'
  'To-Config': Hex.Hex
  'To-Checkpoint': IntegerString
  'To-Config-Complete': BooleanString
  'To-Signers-Count': IntegerString
  'To-Signers-Bloom': Hex.Hex
}

export interface ArweavePlainSignatureTags {
  Type: 'signature'
}

export interface ArweaveSignatureDigestTags {
  'Major-Version': '1'
  Digest: Hex.Hex
}

export interface ArweaveSignatureSubdigestTags {
  'Major-Version': '2'
}

export interface ArweaveSignatureBlockTags {
  'Block-Number': IntegerString
  'Block-Hash': Hex.Hex
}

export interface ArweaveSignatureRecordBase extends ArweaveRecordBase<
  'signature' | 'config update',
  '1' | '2',
  '0',
  'text/plain'
> {
  'Signature-Type': SignatureType
  Signer: Address.Address
  Subdigest: Hex.Hex
  Wallet: Address.Address
  'Chain-ID': IntegerString
  Witness: BooleanString
  data: Hex.Hex
}

export type ArweaveSignatureRecord =
  | (ArweaveSignatureRecordBase & ArweavePlainSignatureTags & ArweaveSignatureDigestTags)
  | (ArweaveSignatureRecordBase & ArweavePlainSignatureTags & ArweaveSignatureSubdigestTags)
  | (ArweaveSignatureRecordBase & ArweavePlainSignatureTags & ArweaveSignatureDigestTags & ArweaveSignatureBlockTags)
  | (ArweaveSignatureRecordBase & ArweavePlainSignatureTags & ArweaveSignatureSubdigestTags & ArweaveSignatureBlockTags)
  | (ArweaveSignatureRecordBase & ArweaveConfigUpdateTags & ArweaveSignatureDigestTags)
  | (ArweaveSignatureRecordBase & ArweaveConfigUpdateTags & ArweaveSignatureSubdigestTags)
  | (ArweaveSignatureRecordBase & ArweaveConfigUpdateTags & ArweaveSignatureDigestTags & ArweaveSignatureBlockTags)
  | (ArweaveSignatureRecordBase & ArweaveConfigUpdateTags & ArweaveSignatureSubdigestTags & ArweaveSignatureBlockTags)

export interface ArweaveSapientSignatureRecordBase extends ArweaveRecordBase<
  'signature' | 'config update',
  '2',
  '0',
  'text/plain'
> {
  'Signature-Type': SignatureType
  Signer: Address.Address
  'Image-Hash': Hex.Hex
  Subdigest: Hex.Hex
  Wallet: Address.Address
  'Chain-ID': IntegerString
  'Block-Number': IntegerString
  'Block-Hash': Hex.Hex
  Witness: BooleanString
  data: Hex.Hex
}

export type ArweaveSapientSignatureRecord =
  | (ArweaveSapientSignatureRecordBase & ArweavePlainSignatureTags)
  | (ArweaveSapientSignatureRecordBase & ArweaveConfigUpdateTags)

export interface ArweaveMigrationRecord extends ArweaveRecordBase<'migration', '1', '0', 'text/plain'> {
  Migration: Address.Address
  'Chain-ID': IntegerString
  'From-Version': ConfigVersion
  'From-Config': Hex.Hex
  'From-Config-Complete': BooleanString
  'From-Signers-Count': IntegerString
  'From-Signers-Bloom': Hex.Hex
  'To-Version': ConfigVersion
  'To-Config': Hex.Hex
  'To-Config-Complete': BooleanString
  'To-Signers-Count': IntegerString
  'To-Signers-Bloom': Hex.Hex
  Executor: Address.Address
  data: Hex.Hex
}

export type ArweaveRecord =
  | ArweaveConfigRecord
  | ArweaveTreeRecord
  | ArweaveWalletRecord
  | ArweavePayloadRecord
  | ArweaveSignatureRecord
  | ArweaveSapientSignatureRecord
  | ArweaveMigrationRecord

export type ArweaveObject = ArweaveRecord
