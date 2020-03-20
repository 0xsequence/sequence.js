
import { utils } from 'ethers'
import * as ethers from 'ethers'
import { Wallet } from 'ethers'
import { encodeData } from './encoding'

import {
    Opts,
} from 'typings/types'

const DOMAIN_SEPARATOR_TYPEHASH = '0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749'

class Contract {
    abi: utils.Interface
    address: string

    constructor(abiStr: string, address: string) {
        this.abi = new utils.Interface(abiStr);
        this.address = address
    }

    domainHash(): string {
        return ethers.utils.keccak256(ethers.utils.solidityPack(
            ['bytes32', 'uint256'], 
            [DOMAIN_SEPARATOR_TYPEHASH, this.address]
        ))
    }

    async call(opts: Opts, signer: Wallet, methodName: string, params: any[]): Promise<string> {
        const method = this.abi.functions[methodName]
        if (method == undefined) {
            throw Error("method not found")
        }

        const domainHash = this.domainHash()

        const sigData = this.encodeMembers(method, params, opts)

        // last field of the method
        const data = await encodeData(signer, sigData, opts, domainHash)

        // fill the rest of the params of the method
        params.push(opts.gasReceipt ? true : false)
        params.push(data)

        return method.encode(params)
    }

    encodeMembers(method, params: any[], opts: Opts) {
        if (method.inputs.length != params.length+2) {
            throw Error()
        }
        
        const typehash = utils.keccak256(utils.toUtf8Bytes(method.signature))

        let res = ""
        const append = function(data: string) {
            res += data.substring(2)
        }

        // encode typehash
        append(ethers.utils.solidityPack(['uint256'], [typehash]))

        // encode inputs
        for (var indx in params) {
            append(encodeMember(method.inputs[indx], params[indx]))
        }
        
        // encode isGasFee
        append(ethers.utils.solidityPack(['uint256'], [opts.gasReceipt ? '0x1' : '0x0']))

        // encode nonce
        append(ethers.utils.solidityPack(['uint256'], [opts.nonce]))

        return "0x" + res
    }
}

function encodeMember(type, param): string{
    let encType = type.internalType
    switch (type.internalType) {
        case 'address':
        case 'bool':
            // address and bool are encoded as uint256 of 32 bytes
            encType = 'uint256'
            
            // booleans need to be converted to ints
            if (type.internalType == "bool") {
                if (param == true) {
                    param = 1
                } else if (param == false) {
                    param = 0
                } else {
                    throw Error("")
                }
            }
    }

    let data = ethers.utils.solidityPack([encType], [param])

    // if the input is an slice we need to hash it
    if (encType.endsWith('[]')) {
        data = ethers.utils.keccak256(data)
    }
    return data
}

export default Contract
