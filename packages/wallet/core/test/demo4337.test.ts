import { vi, beforeEach, describe, it, expect } from 'vitest'
import { Wallet } from '../src/wallet.js'
import { Abi, AbiFunction, AbiParameters, Address, Hash, Hex, Provider, RpcTransport, Secp256k1 } from 'ox'
import { EntryPoint, UserOperation } from 'ox/erc4337'
import { ADD_HOOK, EXECUTE_USER_OP } from '../../primitives/dist/constants.js'
import { Pk } from '../src/signers/pk/index.js'
import { Envelope, Relayer } from '../src/index.js'
import { PkRelayer } from '../src/relayer/pk-relayer.js'
import { Payload, Signature } from '@0xsequence/wallet-primitives'

describe('demo4337', () => {
  it(
    'demo1',
    async () => {
      const signerPk = '0x57f8ae37a6d0b76123b9a78dbbb82930c0c2f50d559292581cb55cdedfc4a8f8'
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

      console.log('WALLET ADDRESS', wallet.address)

      // Arbitrum provider
      const arbitrumProvider = Provider.from(RpcTransport.fromHttp('https://nodes.sequence.app/arbitrum'))

      // Prepare transaction adding hooks to the wallet
      const envelope1 = await wallet.prepareTransaction(
        arbitrumProvider,
        [
          {
            to: wallet.address,
            value: 0n,
            data: AbiFunction.encodeData(ADD_HOOK, ['0x9c145aed', '0x21b1315475650399E21AD9Ed704d21Fa2d0640bd']),
            gasLimit: 0n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
          {
            to: wallet.address,
            value: 0n,
            data: AbiFunction.encodeData(ADD_HOOK, ['0x19822f7c', '0x21b1315475650399E21AD9Ed704d21Fa2d0640bd']),
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
            value: 1300000000000000n,
            data: '0x',
            gasLimit: 50_000n,
            delegateCall: false,
            onlyFallback: false,
            behaviorOnError: 'revert',
          },
        ],
      }

      const packedPayload = Hex.fromBytes(Payload.encode(randomUserOperation))
      const operation: UserOperation.UserOperation<'0.7', false> = {
        sender: wallet.address,
        nonce: 3n,
        callData: AbiFunction.encodeData(EXECUTE_USER_OP, [packedPayload]),
        callGasLimit: 200_000n,
        maxFeePerGas: 100000000n,
        maxPriorityFeePerGas: 10000000n,
        preVerificationGas: 150_000n,
        verificationGasLimit: 100_000n,
      }

      const accountGasLimits = Hex.concat(
        Hex.padLeft(Hex.fromNumber(operation.verificationGasLimit), 16),
        Hex.padLeft(Hex.fromNumber(operation.callGasLimit), 16),
      )
      const gasFees = Hex.concat(
        Hex.padLeft(Hex.fromNumber(operation.maxPriorityFeePerGas), 16),
        Hex.padLeft(Hex.fromNumber(operation.maxFeePerGas), 16),
      )
      const initCode_hashed = Hash.keccak256(
        operation.factory && operation.factoryData ? Hex.concat(operation.factory, operation.factoryData) : '0x',
      )
      const paymasterAndData_hashed = Hash.keccak256(
        operation.paymaster
          ? Hex.concat(
              operation.paymaster,
              Hex.padLeft(Hex.fromNumber(operation.paymasterVerificationGasLimit || 0), 16),
              Hex.padLeft(Hex.fromNumber(operation.paymasterPostOpGasLimit || 0), 16),
              operation.paymasterData || '0x',
            )
          : '0x',
      )

      const packedUserOp = AbiParameters.encode(
        [
          { type: 'address' },
          { type: 'uint256' },
          { type: 'bytes32' },
          { type: 'bytes32' },
          { type: 'bytes32' },
          { type: 'uint256' },
          { type: 'bytes32' },
          { type: 'bytes32' },
        ],
        [
          operation.sender,
          operation.nonce,
          initCode_hashed,
          Hash.keccak256(operation.callData),
          accountGasLimits,
          operation.preVerificationGas,
          gasFees,
          paymasterAndData_hashed,
        ],
      )

      const entrypoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

      const signMessage = AbiParameters.encode(
        [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
        [Hash.keccak256(packedUserOp), entrypoint, 42161n],
      )

      const signPayload = Payload.fromMessage(signMessage)
      console.log(signPayload)

      const opHash = UserOperation.hash(operation, {
        chainId: 42161,
        entryPointAddress: entrypoint,
        entryPointVersion: '0.7',
      })
      console.log('opHash', opHash)

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

      // Encoded for manual call
      const encodedUserOp = UserOperation.toPacked(signedUserOperation)
      console.log('packed user op', encodedUserOp)

      // const envelope2

      // pack exactly as the contract expects
      const packed = UserOperation.toPacked(signedUserOperation)
      const beneficiary = signer.address

      const data = AbiFunction.encodeData(AbiFunction.fromAbi(EntryPoint.abiV07, 'handleOps'), [[packed], beneficiary])

      // send or just simulate with callStatic
      console.log('entrypoint data', data)
      // const { hash } = await signer.({ to: entrypoint, data })
      // console.log('handleOps tx', hash)

      const bundler = 'https://api.pimlico.io/v2/42161/rpc?apikey=pim_XuUPRNzR5t5XUpAiZ2yQVQ'
      const provider = Provider.from(RpcTransport.fromHttp(bundler))

      const status = await provider.request({
        method: 'eth_sendUserOperation',
        params: [rpcSignedUserOperation, entrypoint],
      })

      console.log(status)
    },
    { timeout: 1000000 },
  )
})
