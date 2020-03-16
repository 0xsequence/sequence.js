
import { BigNumber, joinSignature, toUtf8Bytes, defaultAbiCoder } from 'ethers/utils'
import * as ethers from 'ethers'
import { Wallet } from 'ethers'

import {
    Opts,
    GasReceipt,
} from 'typings/types'

export const GasReceiptType = `tuple(
    uint256 gasFee,
    uint256 gasLimitCallback,
    address feeRecipient,
    bytes feeTokenData
)`

export function encodeGasReceipt(g: GasReceipt) { 
    return defaultAbiCoder.encode([GasReceiptType], [g])
}

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

async function encodeData(signerWallet: Wallet, opts: Opts, domainHash: string) 
{
  const META_BATCH_TX_TYPEHASH = '0xa3d4926e8cf8fe8e020cd29f514c256bc2eec62aa2337e415f1a33a4828af5a0';

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

  let sigData;     // Data to sign
  let txDataTypes; // Types of data to encode
  let sig;         // Signature

  // Struct Data type
  const sigArgTypes = [
    'bytes32', // META_TX_TYPEHASH
    'uint256', // _from: uint256(address)
    'uint256', // _to: uint256(address)
    'bytes32', // keccak256(_ids)
    'bytes32', // keccak256(_amounts)
    'uint256', // _isGasFee: uint256(bool)
    'uint256', // nonce
    // 'bytes32', // hash of transfer data (added below, if any)
    ];
  
  let is_gas_Fee_hex = opts.gasReceipt ? '0x1' : '0x0'

  // Packed encoding of transfer signature message
  sigData = ethers.utils.solidityPack(sigArgTypes, [
    META_BATCH_TX_TYPEHASH,
    signer,
    s.receiver,
    ethers.utils.keccak256(ethers.utils.solidityPack(['uint256[]'], [s.ids])),
    ethers.utils.keccak256(ethers.utils.solidityPack(['uint256[]'], [s.amounts])),
    is_gas_Fee_hex,
    opts.nonce,
  ])

  txDataTypes = ['bytes', 'bytes']; // (sig, (gasReceipt, transferData))

  // When gas receipt is included
  if (opts.gasReceipt && opts.gasReceipt !== null) {

    // 1. 
    if (opts.extra !== null) {
      let gasAndTransferData = defaultAbiCoder.encode([GasReceiptType, 'bytes'], [opts.gasReceipt, opts.extra])   
      sigData = ethers.utils.keccak256(ethers.utils.solidityPack(
        ['bytes', 'bytes32'], 
        [sigData, ethers.utils.keccak256(gasAndTransferData)] //Hash of _data
      ))
      sig = await ethSignTypedData(signerWallet, domainHash,  sigData, opts.nonce)
      return defaultAbiCoder.encode(txDataTypes, [sig, gasAndTransferData])

    // 2.
    } else {
      let gasAndTransferData = defaultAbiCoder.encode([GasReceiptType, 'bytes'], [opts.gasReceipt, toUtf8Bytes('')])
      sigData = ethers.utils.keccak256(ethers.utils.solidityPack(
        ['bytes', 'bytes32'], 
        [sigData, ethers.utils.keccak256(gasAndTransferData)] //Hash of _data
      ))
      sig = await ethSignTypedData(signerWallet, domainHash,  sigData, opts.nonce)
      return  defaultAbiCoder.encode(txDataTypes, [sig, gasAndTransferData])
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
