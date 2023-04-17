import axios from 'axios'
import { createLogger, Logger } from '../utils/logger'

let prompt: Logger
createLogger().then(logger => (prompt = logger))

export interface CompilerInput {
  language: string; // "Solidity" or "Yul"
  sources: { [sourceName: string]: { content: string } };
  settings: {
    viaIR?: boolean;
    optimizer: {
      runs?: number;
      enabled?: boolean;
      details?: { // If viaIR then detail: {yulDetails: {optimizerSteps: "u"}}}
        yul?: boolean,
        yulDetails?: {
          optimizerSteps: string;
        };
      };
    };
    metadata?: { useLiteralContent: boolean };
    outputSelection: {
      [sourceName: string]: {
        [contractName: string]: string[];
      };
    };
    evmVersion?: string;
    libraries?: {
      [libraryFileName: string]: {
        [libraryName: string]: string;
      };
    };
    remappings?: string[];
  };
}

export type EtherscanVerificationRequest = {
  contractToVerify: string
  version: string // https://etherscan.io/solcversions
  compilerInput: CompilerInput
  constructorArgs?: string // As a hex string (undefined if none)
  waitForSuccess: boolean // Whether to wait for success or return after sending the request
}

type EtherscanApiResponse = {
  status: string
  result: string
  message?: string // Error
}

export class EtherscanVerifier {
  constructor(private readonly apiKey: string, private readonly networkName: string) {}

  // Throws on failure
  verifyContract = async (addr: string, request: EtherscanVerificationRequest): Promise<void> => {
    // Determine network
    const apiUrl = `https://api${this.networkName === 'homestead' ? '' : `-${this.networkName}`}.etherscan.io/api`

    //TODO Filter out already verified contracts

    // Create verification body
    let body: Record<string, string> = {
      apikey: this.apiKey,
      module: 'contract',
      action: 'verifysourcecode',
      contractaddress: addr,
      sourceCode: JSON.stringify(request.compilerInput),
      codeformat: 'solidity-standard-json-input',
      contractname: request.contractToVerify,
      compilerversion: request.version,
    }
    if (request.constructorArgs) {
      body.constructorArguements = request.constructorArgs // Typo in Etherscan API
    }

    //TODO Add linked library information

    // Send the request
    prompt.start(`Verifying ${request.contractToVerify}`)
    prompt.info(`Verifying at ${apiUrl}`)
    try {
      const guid = await this.sendVerifyRequest(apiUrl, body)

      if (request.waitForSuccess) {
        await this.waitForVerification(apiUrl, guid)
      }
    } catch (err: unknown) {
      prompt.fail(`Failed to verify`)
      prompt.fail((err as Error).message)
      prompt.stop()
      throw err
    }

    prompt.stop()
  }

  // Throws on failure
  sendVerifyRequest = async (apiUrl: string, body: Record<string, string>): Promise<string> => {
    const res = await axios.post(apiUrl, new URLSearchParams(body))
    let errMsg
    if (res.status < 200 || res.status > 299) {
      errMsg = `Failed to verify. Code: ${res.status}`
    } else {
      // Try parse response
      const json = res.data as EtherscanApiResponse
      if (json.status === '1') {
        // Success
        prompt.succeed(`Verification started`)
        const guid = json.result
        return guid
      } else {
        errMsg = `Failed to verify. Result: ${json.result}. Message: ${json.message}`
      }
    }
    // Fail over
    prompt.fail(errMsg)
    throw Error(errMsg)
  }

  // Throws on failure
  waitForVerification = async (apiUrl: string, guid: string): Promise<void> => {
    // Wait for verification to complete
    prompt.info(`Waiting for verification to complete`)

    let status = 'Pending'
    while (status.includes('Pending')) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Delay 5s
      const params = new URLSearchParams({
        module: 'contract',
        action: 'checkverifystatus',
        apikey: this.apiKey,
        guid,
      })
      const res = await axios.get(apiUrl, {params})
      const json = res.data as EtherscanApiResponse
      status = json.result
      prompt.info(`Verification status: ${status}`)
    }

    // Success or failure
    if (status.includes('Pass')) {
      prompt.succeed(`Verification successful`)
    } else {
      // Failed
      const msg = `Verification failed with ${status}`
      prompt.fail(msg)
      throw Error(msg)
    }
  }
}
