
import { BigNumber, joinSignature, toUtf8Bytes, defaultAbiCoder } from 'ethers/utils'
import * as ethers from 'ethers'
import { Wallet } from 'ethers'

import {
    Opts,
    GasReceipt,
} from 'typings/types'

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
    wallet: ethers.Wallet, 
    domainHash: string,  
    hashStruct: string | Uint8Array, 
    nonce: BigNumber) 
  {
    const EIP191_HEADER = "0x1901"
    const preHash = ethers.utils.solidityPack(['bytes', 'bytes32'], [EIP191_HEADER, domainHash])
    const hash = ethers.utils.keccak256(ethers.utils.solidityPack(
        ['bytes', 'bytes32'], 
        [preHash, hashStruct]
      ))
  
    const hashArray = ethers.utils.arrayify(hash) 
    let ethsigNoType = await wallet.signMessage(hashArray)
    let paddedNonce = ethers.utils.solidityPack(['uint256'], [nonce])
    let ethsigNoType_nonce = ethsigNoType + paddedNonce.slice(2) // encode packed the nonce
    return ethsigNoType_nonce + '02' // signed data type 2
  }

export async function encodeData(signerWallet: Wallet, sigData: string, opts: Opts, domainHash: string) {
  if (opts.extra == undefined) {
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

  let txDataTypes; // Types of data to encode
  let sig;         // Signature

  txDataTypes = ['bytes', 'bytes']; // (sig, (gasReceipt, transferData))

  // When gas receipt is included
  if (opts.gasReceipt && opts.gasReceipt !== null) {

    // encode gas receipt and the transfer data
    const receipt = {
      gasFee: opts.gasReceipt.gasFee,
      gasLimitCallback: opts.gasReceipt.gasLimitCallback,
      feeRecipient: opts.gasReceipt.feeRecipient,
      feeTokenData: "",
    }

    const feeTokenData = opts.gasReceipt.feeTokenData;
    switch (feeTokenData.type) {
      case 0:
        // erc1155
        receipt.feeTokenData = defaultAbiCoder.encode([erc1155TokenDataType], [{"token": feeTokenData.address, "id": feeTokenData.id, "type": 0}])
        break
      case 1:
        // erc20
        receipt.feeTokenData = defaultAbiCoder.encode([erc20TokenDataType], [{"token": feeTokenData.address, "type": 1}])
        break
      default:
        throw Error("")
    }

    // 1. 
    if (opts.extra !== null) {
      let gasAndTransferData = defaultAbiCoder.encode([GasReceiptType, 'bytes'], [receipt, opts.extra])   
      sigData = ethers.utils.keccak256(ethers.utils.solidityPack(
        ['bytes', 'bytes32'], 
        [sigData, ethers.utils.keccak256(gasAndTransferData)] //Hash of _data
      ))
      sig = await ethSignTypedData(signerWallet, domainHash,  sigData, opts.nonce)
      return defaultAbiCoder.encode(txDataTypes, [sig, gasAndTransferData])

    // 2.
    } else {
      let gasAndTransferData = defaultAbiCoder.encode([GasReceiptType, 'bytes'], [receipt, toUtf8Bytes('')])
      sigData = ethers.utils.keccak256(ethers.utils.solidityPack(
        ['bytes', 'bytes32'], 
        [sigData, ethers.utils.keccak256(gasAndTransferData)] //Hash of _data
      ))
      sig = await ethSignTypedData(signerWallet, domainHash,  sigData, opts.nonce)
      return defaultAbiCoder.encode(txDataTypes, [sig, gasAndTransferData])
    }

  } else { 

    // 3.
    if (opts.extra !== null) {
      sigData = ethers.utils.keccak256(ethers.utils.solidityPack(
        ['bytes', 'bytes32'], 
        [sigData, ethers.utils.keccak256(opts.extra)] //Hash of _data
      ))
      sig = await ethSignTypedData(signerWallet, domainHash,  sigData, opts.nonce)
      return  defaultAbiCoder.encode(txDataTypes, [sig, opts.extra])

    // 4.
    } else { 
      let emptyTransferData = defaultAbiCoder.encode(['bytes'], [toUtf8Bytes('')])
      sigData = ethers.utils.keccak256(ethers.utils.solidityPack(
        ['bytes', 'bytes32'], 
        [sigData, ethers.utils.keccak256(emptyTransferData)] //Hash of _data
      ))
      sig = await ethSignTypedData(signerWallet, domainHash,  sigData, opts.nonce)
      return  defaultAbiCoder.encode(txDataTypes, [sig, emptyTransferData])
    }
  }
}
