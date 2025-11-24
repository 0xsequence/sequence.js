import { Utils } from '@0xsequence/wallet-primitives';
export class DevHttpProvider {
    baseUrl;
    constructor(baseUrl) {
        // Remove trailing slash if present
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const options = {
            method,
            headers: {},
        };
        if (body && method === 'POST') {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = Utils.toJSON(body);
        }
        let response;
        try {
            response = await fetch(url, options);
        }
        catch (networkError) {
            // Handle immediate network errors (e.g., DNS resolution failure, refused connection)
            console.error(`Network error during ${method} request to ${url}:`, networkError);
            throw networkError; // Re-throw network errors
        }
        // --- Error Handling for HTTP Status ---
        if (!response.ok) {
            let errorPayload = { message: `HTTP error! Status: ${response.status}` };
            try {
                const errorText = await response.text();
                const errorJson = await Utils.fromJSON(errorText);
                errorPayload = { ...errorPayload, ...errorJson };
            }
            catch (e) {
                try {
                    // If JSON parsing fails, try getting text for better error message
                    const errorText = await response.text();
                    errorPayload.body = errorText;
                }
                catch (textErr) {
                    // Ignore if reading text also fails
                }
            }
            console.error('HTTP Request Failed:', errorPayload);
            throw new Error(errorPayload.message || `Request failed for ${method} ${path} with status ${response.status}`);
        }
        // --- Response Body Handling (with fix for empty body) ---
        try {
            // Handle cases where POST might return 201/204 No Content
            // 204 should definitely have no body. 201 might or might not.
            if (response.status === 204) {
                return undefined; // No content expected
            }
            if (response.status === 201 && method === 'POST') {
                // Attempt to parse JSON (e.g., for { success: true }), but handle empty body gracefully
                const text = await response.clone().text(); // Clone and check text first
                if (text.trim() === '') {
                    return undefined; // Treat empty 201 as success with no specific return data
                }
                // If not empty, try parsing JSON
                const responseText = await response.text();
                return (await Utils.fromJSON(responseText));
            }
            // For 200 OK or other success statuses expecting a body
            // Clone the response before attempting to read the body,
            // so we can potentially read it again (as text) if json() fails.
            const clonedResponse = response.clone();
            const textContent = await clonedResponse.text(); // Read as text first
            if (textContent.trim() === '') {
                // If the body is empty (or only whitespace) and status was OK (checked above),
                // treat this as the server sending 'undefined' or 'null'.
                // Return `undefined` to match the expected optional types in the Provider interface.
                return undefined;
            }
            else {
                // If there is content, attempt to parse it as JSON.
                // We use the original response here, which hasn't had its body consumed yet.
                const responseText = await response.text();
                const data = await Utils.fromJSON(responseText);
                // BigInt Deserialization note remains the same: manual conversion may be needed by consumer.
                return data;
            }
        }
        catch (error) {
            // This catch block now primarily handles errors from response.json()
            // if the non-empty textContent wasn't valid JSON.
            console.error(`Error processing response body for ${method} ${url}:`, error);
            // Also include the raw text in the error if possible
            try {
                const text = await response.text(); // Try reading original response if not already done
                throw new Error(`Failed to parse JSON response from server. Status: ${response.status}. Body: "${text}". Original error: ${error instanceof Error ? error.message : String(error)}`);
            }
            catch (readError) {
                throw new Error(`Failed to parse JSON response from server and could not read response body as text. Status: ${response.status}. Original error: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    // --- Reader Methods ---
    async getConfiguration(imageHash) {
        // The response needs careful handling if BigInts are involved (threshold, checkpoint)
        const config = await this.request('GET', `/configuration/${imageHash}`);
        // Manual conversion example (if needed by consumer):
        // if (config?.threshold) config.threshold = BigInt(config.threshold);
        // if (config?.checkpoint) config.checkpoint = BigInt(config.checkpoint);
        return config;
    }
    async getDeploy(wallet) {
        return this.request('GET', `/deploy/${wallet}`);
    }
    async getWallets(signer) {
        // Response `chainId` will be a string/number, needs conversion if BigInt is strictly required upstream
        return this.request('GET', `/wallets/signer/${signer}`);
    }
    async getWalletsForSapient(signer, imageHash) {
        // Response `chainId` will be a string/number, needs conversion
        return this.request('GET', `/wallets/sapient/${signer}/${imageHash}`);
    }
    async getWitnessFor(wallet, signer) {
        // Response `chainId` will be a string/number, needs conversion
        return this.request('GET', `/witness/${wallet}/signer/${signer}`);
    }
    async getWitnessForSapient(wallet, signer, imageHash) {
        // Response `chainId` will be a string/number, needs conversion
        return this.request('GET', `/witness/sapient/${wallet}/${signer}/${imageHash}`);
    }
    async getConfigurationUpdates(wallet, fromImageHash, options) {
        const query = options?.allUpdates ? '?allUpdates=true' : '';
        // Response signature object might contain BigInts (threshold, checkpoint) as strings
        return this.request('GET', `/configuration-updates/${wallet}/from/${fromImageHash}${query}`);
    }
    async getTree(rootHash) {
        return this.request('GET', `/tree/${rootHash}`);
    }
    // --- Writer Methods ---
    async saveWallet(deployConfiguration, context) {
        await this.request('POST', '/wallet', { deployConfiguration, context });
    }
    async saveWitnesses(wallet, chainId, payload, signatures) {
        // chainId will be correctly stringified by the jsonReplacer
        await this.request('POST', '/witnesses', { wallet, chainId, payload, signatures });
    }
    async saveUpdate(wallet, configuration, signature) {
        // configuration and signature might contain BigInts, handled by replacer
        await this.request('POST', '/update', { wallet, configuration, signature });
    }
    async saveTree(tree) {
        await this.request('POST', '/tree', { tree });
    }
    saveConfiguration(config) {
        return this.request('POST', '/configuration', { config });
    }
    saveDeploy(imageHash, context) {
        return this.request('POST', '/deploy', { imageHash, context });
    }
    async getPayload(opHash) {
        return this.request('GET', `/payload/${opHash}`);
    }
    async savePayload(wallet, payload, chainId) {
        return this.request('POST', '/payload', { wallet, payload, chainId });
    }
}
