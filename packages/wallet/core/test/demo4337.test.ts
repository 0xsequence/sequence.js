import { vi, beforeEach, describe, it, expect } from 'vitest'
import { Wallet } from '../src/wallet.js'
import { AbiFunction, AbiParameters, Address, Hash, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'
import { UserOperation } from 'ox/erc4337'
import { ADD_HOOK, EXECUTE_USER_OP } from '../../primitives/dist/constants.js'
import { Pk } from '../src/signers/pk/index.js'
import { Envelope, Relayer } from '../src/index.js'
import { PkRelayer } from '../src/relayer/pk-relayer.js'
import { Payload, Signature } from '@0xsequence/wallet-primitives'

describe('demo4337', () => {
  it(
    'demo1',
    async () => {
      const signerPk = Hex.random(32)
      const signer = new Pk(signerPk)

      const wallet = await Wallet.fromConfiguration({
        threshold: 1n,
        checkpoint: 0n,
        topology: {
          type: 'signer',
          address: signer.address,
          weight: 1n,
        },
      })

      console.log(wallet.address)

      // Arbitrum provider
      const arbitrumProvider = Provider.from(RpcTransport.fromHttp('https://nodes.sequence.app/arbitrum'))

      // Prepare transaction adding hooks to the wallet
      const envelope1 = await wallet.prepareTransaction(
        arbitrumProvider,
        [
          {
            to: wallet.address,
            value: 0n,
            data: AbiFunction.encodeData(ADD_HOOK, ['0x9c145aed', '0x9dc19C4AC9B26FdFFb0668Bc7ac098f240c74C87']),
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
          {
            to: wallet.address,
            value: 0n,
            data: AbiFunction.encodeData(ADD_HOOK, ['0x19822f7c', '0x9dc19C4AC9B26FdFFb0668Bc7ac098f240c74C87']),
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ],
        { unsafe: true },
      )

      const signedEnvelope = Envelope.toSigned(envelope1)

      // Sign using signer
      const signature = await signer.sign(envelope1.wallet, envelope1.chainId, envelope1.payload)
      Envelope.addSignature(signedEnvelope, {
        address: signer.address,
        signature,
      })

      // Create local relayer with some funds
      const relayerPk = '0xfefd354463cd6a09619b34dcfa32f475e7e1e0533a1e3544ff4a1fa3ac6393fc'
      const relayer = new PkRelayer(relayerPk, arbitrumProvider)

      // Send transaction
      const transaction = await wallet.buildTransaction(arbitrumProvider, signedEnvelope)
      console.log(transaction)

      // const { opHash } = await relayer.relay(
      //   transaction.to,
      //   transaction.data,
      //   signedEnvelope.chainId,
      //   undefined,
      // )
      // console.log(opHash)

      const randomUserOperation: Payload.Calls = {
        nonce: 0n,
        space: 0n,
        type: 'call',
        calls: [
          {
            to: '0x750EF1D7a0b4Ab1c97B7A623D7917CcEb5ea779C',
            value: 100000000000000n,
            data: '0x',
            gasLimit: 50_000n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ],
      }

      const packedPayload = Hex.fromBytes(Payload.encode(randomUserOperation))
      const operation: UserOperation.UserOperation<'0.6', false> = {
        sender: wallet.address,
        nonce: 0n,
        initCode: '0x',
        callData: AbiFunction.encodeData(EXECUTE_USER_OP, [packedPayload]),
        callGasLimit: 200_000n,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 1000000000n,
        preVerificationGas: 50_000n,
        verificationGasLimit: 50_000n,
      }

      const packedUserOp = AbiParameters.encode(
        [
          { type: 'address' },
          { type: 'uint256' },
          { type: 'bytes32' },
          { type: 'bytes32' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'bytes32' },
        ],
        [
          operation.sender,
          operation.nonce,
          Hash.keccak256(operation.initCode ?? '0x'),
          Hash.keccak256(operation.callData),
          operation.callGasLimit,
          operation.verificationGasLimit,
          operation.preVerificationGas,
          operation.maxFeePerGas,
          operation.maxPriorityFeePerGas,
          Hash.keccak256(operation.paymasterAndData ?? '0x'),
        ],
      )

      const signMessage = AbiParameters.encode(
        [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
        [Hash.keccak256(packedUserOp), '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', 42161n],
      )

      const signPayload = Payload.fromMessage(signMessage)
      console.log(signPayload)

      const blankEnvelope2 = await wallet.prepareBlankEnvelope(42161n)
      const envelope2: Envelope.Envelope<Payload.Message> = {
        ...blankEnvelope2,
        payload: signPayload,
      }

      const signedEnvelope2 = Envelope.toSigned(envelope2)

      // Sign envelope 2
      const signature2 = await signer.sign(envelope2.wallet, envelope2.chainId, envelope2.payload)
      Envelope.addSignature(signedEnvelope2, {
        address: signer.address,
        signature: signature2,
      })

      console.log(signedEnvelope2)

      const encoded = Hex.fromBytes(Signature.encodeSignature(Envelope.encodeSignature(signedEnvelope2)))

      let signedUserOperation: UserOperation.UserOperation<'0.6', true> = {
        ...operation,
        signature: encoded,
      }

      const rpcSignedUserOperation = UserOperation.toRpc(signedUserOperation)

      console.log(rpcSignedUserOperation)

      // const envelope2

      // const bundler = 'https://api.pimlico.io/v2/arbitrum/rpc';
      // const provider = Provider.from(RpcTransport.fromHttp(bundler))

      // const status = await provider.request({
      //   method: 'eth_getTransactionReceipt',
      //   params: [opHash],
      // })
    },
    { timeout: 1000000 },
  )
})
