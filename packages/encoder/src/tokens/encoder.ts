import * as ethers from 'ethers'
import { utils } from 'ethers'
import meta_erc1155 from 'multi-token-standard/build/contracts/ERC1155Meta.json'
import { ERC1155MetaInterface } from 'multi-token-standard/typings/contracts/ERC1155Meta'

import { MetaTxMethods, MetaTxnOpts } from './types'
const DOMAIN_SEPARATOR_TYPEHASH = '0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749'

export class TokenEncoder {
  signer: ethers.Signer
  abi: ethers.utils.Interface
  domainHash: string

  constructor(_contractAddress: string, _signer: ethers.Signer) {
    this.signer = _signer

    this.abi = new ethers.utils.Interface(meta_erc1155.abi) as ERC1155MetaInterface

    this.domainHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes32', 'uint256'], [DOMAIN_SEPARATOR_TYPEHASH, _contractAddress])
    )
  }

  async encode({ type, params }: MetaTxMethods, opts: MetaTxnOpts): Promise<string> {
    const method = this.abi.functions[type]

    if (!method) {
      throw new Error('method not found in ABI')
    }

    const signerAddress = await this.signer.getAddress()
    const isGasFee = !!opts.gasReceipt

    const data = await encodeData(
      this.signer,
      this.encodeMembers(method, [signerAddress, ...params], opts),
      opts,
      this.domainHash
    )

    return method.encode([signerAddress, ...params, isGasFee, data])
  }

  encodeMembers(method, params: any[], opts: MetaTxnOpts) {
    if (method.inputs.length !== params.length + 2) {
      throw Error()
    }

    const typehash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(method.signature))

    let res = ''
    const append = (data: string) => {
      res += data.substring(2)
    }

    // encode typehash
    append(ethers.utils.solidityPack(['uint256'], [typehash]))

    // encode inputs
    for (const indx in params) {
      append(encodeMember(method.inputs[indx], params[indx]))
    }

    // encode isGasFee
    append(ethers.utils.solidityPack(['uint256'], [opts.gasReceipt ? '0x1' : '0x0']))

    // encode nonce
    append(ethers.utils.solidityPack(['uint256'], [opts.nonce]))

    return '0x' + res
  }
}

function encodeMember(type, param): string {
  let encType = type.internalType
  switch (type.internalType) {
    case 'address':
    case 'bool':
      // address and bool are encoded as uint256 of 32 bytes
      encType = 'uint256'

      // booleans need to be converted to ints
      if (type.internalType === 'bool') {
        param = param ? 1 : 0
      }
  }

  let data = ethers.utils.solidityPack([encType], [param])

  // if the input is an slice we need to hash it
  if (encType.endsWith('[]')) {
    data = ethers.utils.keccak256(data)
  }
  return data
}

const GasReceiptType = `tuple(
    uint256 gasFee,
    uint256 gasLimitCallback,
    address feeRecipient,
    bytes feeTokenData
)`

const erc20TokenDataType = `tuple(
  address token,
  uint8 type
)`

const erc1155TokenDataType = `tuple(
  address token,
  uint256 id,
  uint8 type
)`

async function ethSignTypedData(
  wallet: ethers.Signer,
  domainHash: string,
  hashStruct: string | Uint8Array,
  nonce: utils.BigNumber
) {
  const EIP191_HEADER = '0x1901'
  const preHash = ethers.utils.solidityPack(['bytes', 'bytes32'], [EIP191_HEADER, domainHash])
  const hash = ethers.utils.keccak256(ethers.utils.solidityPack(['bytes', 'bytes32'], [preHash, hashStruct]))

  const hashArray = ethers.utils.arrayify(hash)
  const ethsigNoType = await wallet.signMessage(hashArray)
  const paddedNonce = ethers.utils.solidityPack(['uint256'], [nonce])
  const ethsigNoTypeNonce = ethsigNoType + paddedNonce.slice(2) // encode packed the nonce
  return ethsigNoTypeNonce + '02' // signed data type 2
}

export async function encodeData(signerWallet: ethers.Signer, sigData: string, opts: MetaTxnOpts, domainHash: string) {
  if (!opts.extra) {
    opts.extra = null
  }

  /** Three encoding scenario
   *  1. Gas receipt and transfer data:
   *   txData: ((bytes32 r, bytes32 s, uint8 v, SignatureType sigType), (GasReceipt g, bytes transferData))
   *
   *  2. Gas receipt without transfer data:
   *   txData: ((bytes32 r, bytes32 s, uint8 v, SignatureType sigType), (GasReceipt g))
   *
   *  3. No gasReceipt with transferData
   *   txData: ((bytes32 r, bytes32 s, uint8 v, SignatureType sigType), (bytes transferData))
   *
   *  4. No gasReceipt without transferData
   *   txData: ((bytes32 r, bytes32 s, uint8 v, SignatureType sigType))
   */

  let sig // Signature

  const txDataTypes = ['bytes', 'bytes'] // (sig, (gasReceipt, transferData))

  // When gas receipt is included
  if (opts.gasReceipt && opts.gasReceipt !== null) {
    // encode gas receipt and the transfer data
    const receipt = {
      gasFee: opts.gasReceipt.gasFee,
      gasLimitCallback: opts.gasReceipt.gasLimitCallback,
      feeRecipient: opts.gasReceipt.feeRecipient,
      feeTokenData: ''
    }

    const feeTokenData = opts.gasReceipt.feeTokenData
    switch (feeTokenData.type) {
      case 0:
        // erc1155
        receipt.feeTokenData = utils.defaultAbiCoder.encode(
          [erc1155TokenDataType],
          [{ token: feeTokenData.address, id: feeTokenData.id, type: 0 }]
        )
        break
      case 1:
        // erc20
        receipt.feeTokenData = utils.defaultAbiCoder.encode([erc20TokenDataType], [{ token: feeTokenData.address, type: 1 }])
        break
      default:
        throw Error('')
    }

    // 1.
    if (opts.extra !== null) {
      const gasAndTransferData = utils.defaultAbiCoder.encode([GasReceiptType, 'bytes'], [receipt, opts.extra])
      sigData = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['bytes', 'bytes32'],
          [sigData, ethers.utils.keccak256(gasAndTransferData)] // Hash of _data
        )
      )
      sig = await ethSignTypedData(signerWallet, domainHash, sigData, opts.nonce)
      return utils.defaultAbiCoder.encode(txDataTypes, [sig, gasAndTransferData])

      // 2.
    } else {
      const gasAndTransferData = utils.defaultAbiCoder.encode([GasReceiptType, 'bytes'], [receipt, utils.toUtf8Bytes('')])
      sigData = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['bytes', 'bytes32'],
          [sigData, ethers.utils.keccak256(gasAndTransferData)] // Hash of _data
        )
      )
      sig = await ethSignTypedData(signerWallet, domainHash, sigData, opts.nonce)
      return utils.defaultAbiCoder.encode(txDataTypes, [sig, gasAndTransferData])
    }
  } else {
    // 3.
    if (opts.extra !== null) {
      sigData = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['bytes', 'bytes32'],
          [sigData, ethers.utils.keccak256(opts.extra)] // Hash of _data
        )
      )
      sig = await ethSignTypedData(signerWallet, domainHash, sigData, opts.nonce)
      return utils.defaultAbiCoder.encode(txDataTypes, [sig, opts.extra])

      // 4.
    } else {
      const emptyTransferData = utils.defaultAbiCoder.encode(['bytes'], [utils.toUtf8Bytes('')])
      sigData = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['bytes', 'bytes32'],
          [sigData, ethers.utils.keccak256(emptyTransferData)] // Hash of _data
        )
      )
      sig = await ethSignTypedData(signerWallet, domainHash, sigData, opts.nonce)
      return utils.defaultAbiCoder.encode(txDataTypes, [sig, emptyTransferData])
    }
  }
}
