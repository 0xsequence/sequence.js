import { Hex } from 'ox'
import { Address, Config, Context, GenericTree, Payload, Signature, Utils } from '@0xsequence/wallet-primitives'
import { Provider } from '../index.js'

export class DevHttpProvider implements Provider {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const options: RequestInit = {
      method,
      headers: {},
    }

    if (body && method === 'POST') {
      options.headers = { 'Content-Type': 'application/json' }
      options.body = Utils.toJSON(body)
    }

    let response: Response
    try {
      response = await fetch(url, options)
    } catch (networkError) {
      // Handle immediate network errors (e.g., DNS resolution failure, refused connection)
      console.error(`Network error during ${method} request to ${url}:`, networkError)
      throw networkError // Re-throw network errors
    }

    // --- Error Handling for HTTP Status ---
    if (!response.ok) {
      let errorPayload: any = { message: `HTTP error! Status: ${response.status}` }
      try {
        const errorText = await response.text()
        const errorJson = await Utils.fromJSON(errorText)
        errorPayload = { ...errorPayload, ...errorJson }
      } catch (e) {
        try {
          // If JSON parsing fails, try getting text for better error message
          const errorText = await response.text()
          errorPayload.body = errorText
        } catch (textErr) {
          // Ignore if reading text also fails
        }
      }
      console.error('HTTP Request Failed:', errorPayload)
      throw new Error(errorPayload.message || `Request failed for ${method} ${path} with status ${response.status}`)
    }

    // --- Response Body Handling (with fix for empty body) ---
    try {
      // Handle cases where POST might return 201/204 No Content
      // 204 should definitely have no body. 201 might or might not.
      if (response.status === 204) {
        return undefined as T // No content expected
      }
      if (response.status === 201 && method === 'POST') {
        // Attempt to parse JSON (e.g., for { success: true }), but handle empty body gracefully
        const text = await response.clone().text() // Clone and check text first
        if (text.trim() === '') {
          return undefined as T // Treat empty 201 as success with no specific return data
        }
        // If not empty, try parsing JSON
        const responseText = await response.text()
        return (await Utils.fromJSON(responseText)) as T
      }

      // For 200 OK or other success statuses expecting a body
      // Clone the response before attempting to read the body,
      // so we can potentially read it again (as text) if json() fails.
      const clonedResponse = response.clone()
      const textContent = await clonedResponse.text() // Read as text first

      if (textContent.trim() === '') {
        // If the body is empty (or only whitespace) and status was OK (checked above),
        // treat this as the server sending 'undefined' or 'null'.
        // Return `undefined` to match the expected optional types in the Provider interface.
        return undefined as T
      } else {
        // If there is content, attempt to parse it as JSON.
        // We use the original response here, which hasn't had its body consumed yet.
        const responseText = await response.text()
        const data = await Utils.fromJSON(responseText)

        // BigInt Deserialization note remains the same: manual conversion may be needed by consumer.
        return data as T
      }
    } catch (error) {
      // This catch block now primarily handles errors from response.json()
      // if the non-empty textContent wasn't valid JSON.
      console.error(`Error processing response body for ${method} ${url}:`, error)
      // Also include the raw text in the error if possible
      try {
        const text = await response.text() // Try reading original response if not already done
        throw new Error(
          `Failed to parse JSON response from server. Status: ${response.status}. Body: "${text}". Original error: ${error instanceof Error ? error.message : String(error)}`,
        )
      } catch (readError) {
        throw new Error(
          `Failed to parse JSON response from server and could not read response body as text. Status: ${response.status}. Original error: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  // --- Reader Methods ---

  async getConfiguration(imageHash: Hex.Hex): Promise<Config.Config | undefined> {
    // The response needs careful handling if BigInts are involved (threshold, checkpoint)
    const config = await this.request<Config.Config | undefined>('GET', `/configuration/${imageHash}`)
    // Manual conversion example (if needed by consumer):
    // if (config?.threshold) config.threshold = BigInt(config.threshold);
    // if (config?.checkpoint) config.checkpoint = BigInt(config.checkpoint);
    return config
  }

  async getDeploy(wallet: Address.Checksummed): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
    return this.request('GET', `/deploy/${wallet}`)
  }

  async getWallets(signer: Address.Checksummed): Promise<{
    [wallet: Address.Checksummed]: {
      chainId: bigint
      payload: Payload.Parented
      signature: Signature.SignatureOfSignerLeaf
    }
  }> {
    // Response `chainId` will be a string/number, needs conversion if BigInt is strictly required upstream
    return this.request('GET', `/wallets/signer/${signer}`)
  }

  async getWalletsForSapient(
    signer: Address.Checksummed,
    imageHash: Hex.Hex,
  ): Promise<{
    [wallet: Address.Checksummed]: {
      chainId: bigint
      payload: Payload.Parented
      signature: Signature.SignatureOfSapientSignerLeaf
    }
  }> {
    // Response `chainId` will be a string/number, needs conversion
    return this.request('GET', `/wallets/sapient/${signer}/${imageHash}`)
  }

  async getWitnessFor(
    wallet: Address.Checksummed,
    signer: Address.Checksummed,
  ): Promise<
    | {
        chainId: bigint
        payload: Payload.Parented
        signature: Signature.SignatureOfSignerLeaf
      }
    | undefined
  > {
    // Response `chainId` will be a string/number, needs conversion
    return this.request('GET', `/witness/${wallet}/signer/${signer}`)
  }

  async getWitnessForSapient(
    wallet: Address.Checksummed,
    signer: Address.Checksummed,
    imageHash: Hex.Hex,
  ): Promise<
    | {
        chainId: bigint
        payload: Payload.Parented
        signature: Signature.SignatureOfSapientSignerLeaf
      }
    | undefined
  > {
    // Response `chainId` will be a string/number, needs conversion
    return this.request('GET', `/witness/sapient/${wallet}/${signer}/${imageHash}`)
  }

  async getConfigurationUpdates(
    wallet: Address.Checksummed,
    fromImageHash: Hex.Hex,
    options?: { allUpdates?: boolean },
  ): Promise<Array<{ imageHash: Hex.Hex; signature: Signature.RawSignature }>> {
    const query = options?.allUpdates ? '?allUpdates=true' : ''
    // Response signature object might contain BigInts (threshold, checkpoint) as strings
    return this.request('GET', `/configuration-updates/${wallet}/from/${fromImageHash}${query}`)
  }

  async getTree(rootHash: Hex.Hex): Promise<GenericTree.Tree | undefined> {
    return this.request('GET', `/tree/${rootHash}`)
  }

  // --- Writer Methods ---

  async saveWallet(deployConfiguration: Config.Config, context: Context.Context): Promise<void> {
    await this.request<void>('POST', '/wallet', { deployConfiguration, context })
  }

  async saveWitnesses(
    wallet: Address.Checksummed,
    chainId: bigint,
    payload: Payload.Parented,
    signatures: Signature.RawTopology,
  ): Promise<void> {
    // chainId will be correctly stringified by the jsonReplacer
    await this.request<void>('POST', '/witnesses', { wallet, chainId, payload, signatures })
  }

  async saveUpdate(
    wallet: Address.Checksummed,
    configuration: Config.Config,
    signature: Signature.RawSignature,
  ): Promise<void> {
    // configuration and signature might contain BigInts, handled by replacer
    await this.request<void>('POST', '/update', { wallet, configuration, signature })
  }

  async saveTree(tree: GenericTree.Tree): Promise<void> {
    await this.request<void>('POST', '/tree', { tree })
  }

  saveConfiguration(config: Config.Config): Promise<void> {
    return this.request<void>('POST', '/configuration', { config })
  }

  saveDeploy(imageHash: Hex.Hex, context: Context.Context): Promise<void> {
    return this.request<void>('POST', '/deploy', { imageHash, context })
  }

  async getPayload(opHash: Hex.Hex): Promise<
    | {
        chainId: bigint
        payload: Payload.Parented
        wallet: Address.Checksummed
      }
    | undefined
  > {
    return this.request<
      | {
          chainId: bigint
          payload: Payload.Parented
          wallet: Address.Checksummed
        }
      | undefined
    >('GET', `/payload/${opHash}`)
  }

  async savePayload(wallet: Address.Checksummed, payload: Payload.Parented, chainId: bigint): Promise<void> {
    return this.request<void>('POST', '/payload', { wallet, payload, chainId })
  }
}
