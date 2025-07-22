# @0xsequence/dapp-client

## 1. Overview

The `DappClient` is the main entry point for interacting with the Sequence Wallet from any decentralized application (dapp). It provides a high-level, developer-friendly API to manage user sessions across multiple blockchains.

This client simplifies complex wallet interactions such as connecting a user, sending transactions, and signing messages, while handling different communication methods (popup vs. redirect) and session types (implicit vs. explicit) under the hood.

### Core Concepts

- **Multichain by Design:** A single client instance manages connections to multiple blockchains simultaneously.
- **Implicit vs. Explicit Sessions:**
  - **Implicit Session:** The primary session tied to a user's main login (e.g., social or email). It is designed for interacting with specific, pre-approved contracts within your dapp for a seamless UX.
  - **Explicit Session:** A temporary, permissioned session key. Your dapp can request specific permissions (e.g., "allow this key to spend 10 USDC"), and once approved by the user, can perform those actions without further popups.
- **Event-Driven:** Asynchronous operations like signing are handled via an event emitter, creating a single, consistent API for both popup and redirect flows.

## 2. Getting Started

### Installation

```bash
pnpm install @0xsequence/dapp-client
```

### Basic Usage

It is recommended to create and manage a single, singleton instance of the `DappClient` throughout your application.

```typescript
import { DappClient } from '@0xsequence/dapp-client'

// 1. Create a single client instance for your app
const dappClient = new DappClient('popup', 'https://my-wallet-url.com')

// 2. Initialize the client when your application loads
async function initializeClient() {
  try {
    await dappClient.initialize()
    console.log('Client initialized. User is connected:', dappClient.isInitialized)
  } catch (error) {
    console.error('Failed to initialize client:', error)
  }
}

initializeClient()
```

## 3. Class: `DappClient`

The main entry point for interacting with the Wallet. This client manages user sessions across multiple chains, handles connection and disconnection, and provides methods for signing and sending transactions.

### Constructor

**`new DappClient(transportMode, walletUrl, keymachineUrl?)`**

| Parameter       | Type            | Description                                                                                        |
| :-------------- | :-------------- | :------------------------------------------------------------------------------------------------- |
| `transportMode` | `TransportMode` | The communication mode to use with the wallet ('popup' or 'redirect').                             |
| `walletUrl`     | `string`        | The URL of the Ecosystem Wallet.                                                                   |
| `keymachineUrl` | `string`        | (Optional) The URL of the key management service. Defaults to the production Sequence Key Machine. |

---

## 4. API Reference

### Properties

| Property        | Type             | Description                                                               |
| :-------------- | :--------------- | :------------------------------------------------------------------------ |
| `isInitialized` | `boolean`        | `true` if the client has an active and loaded session, `false` otherwise. |
| `loginMethod`   | `string \| null` | The login method used for the current session (e.g., 'google', 'email').  |
| `userEmail`     | `string \| null` | The email address associated with the session, if available.              |
| `transportMode` | `TransportMode`  | (Read-only) The transport mode the client was configured with.            |

### Methods

#### **initialize()**

Initializes the client by loading any existing session from storage. This should be called once when your application loads.

- **Returns:** `Promise<void>`
- **Throws:** `InitializationError` if the process fails.

---

#### **connect()**

Creates and initializes a new user session for a given chain.

- **Parameters:**
  - `chainId`: `ChainId` - The primary chain ID for the new session.
  - `implicitSessionRedirectUrl`: `string` - The URL to redirect back to after login.
  - `permissions?`: `Signers.Session.ExplicitParams` - (Optional) Permissions to request the user to approve for the new session (Unrestricted permissions if not provided).
  - `options?`: `{ preferredLoginMethod?, email? }` - (Optional) Options for the new session.
- **Returns:** `Promise<void>`
- **Throws:** `ConnectionError`, `InitializationError`

---

#### **disconnect()**

Disconnects the client and clears all session data from browser storage. Note: this does not revoke the sessions on-chain.

- **Returns:** `Promise<void>`

---

#### **getWalletAddress()**

Returns the wallet address of the current session.

- **Returns:** `Address.Address | null`

---

#### **getAllSessions()**

Returns an array of all active session keys (both implicit and explicit).

- **Returns:** `Session[]`

---

#### **addExplicitSession()**

Creates and initializes a new explicit session for a given chain.

- **Parameters:**
  - `chainId`: `ChainId` - The chain ID for the new session.
  - `permissions`: `Signers.Session.ExplicitParams` - The permissions to request.
- **Returns:** `Promise<void>`
- **Throws:** `AddExplicitSessionError`, `InitializationError`
- **Example:**
  ```typescript
  // Allow this session to transfer 1 USDC on Polygon
  const USDC_ADDRESS = '0x...'
  const permissions = {
    permissions: [Utils.ERC20PermissionBuilder.buildTransfer(USDC_ADDRESS, '1000000')],
  }
  await dappClient.addExplicitSession(137, permissions)
  ```

---

#### **sendTransaction()**

Signs and sends a transaction using an active session signer.

- **Parameters:**
  - `chainId`: `ChainId` - The chain ID for the transaction.
  - `transactions`: `Transaction[]` - An array of transactions to execute.
  - `feeOption?`: `Relayer.FeeOption` - (Optional) A gas fee option for (ex: User could pay the gas in USDC).
- **Returns:** `Promise<string>` - The transaction hash.
- **Throws:** `TransactionError`, `InitializationError`

---

#### **getFeeOptions()**

Gets available gas fee options for a transaction.

- **Parameters:**
  - `chainId`: `ChainId` - The chain ID for the transaction.
  - `transactions`: `Transaction[]` - The transactions to get fee options for.
- **Returns:** `Promise<Relayer.FeeOption[]>`
- **Throws:** `FeeOptionError`, `InitializationError`

---

#### **signMessage()**

Signs a standard EIP-191 message. The signature is delivered via the `signatureResponse` event.

- **Parameters:**
  - `chainId`: `ChainId` - The chain ID for signing.
  - `message`: `string` - The message to sign.
- **Returns:** `Promise<void>`
- **Throws:** `SigningError`, `InitializationError`

---

#### **signTypedData()**

Signs an EIP-712 typed data object. The signature is delivered via the `signatureResponse` event.

- **Parameters:**
  - `chainId`: `ChainId` - The chain ID for signing.
  - `typedData`: `unknown` - The typed data object to sign.
- **Returns:** `Promise<void>`
- **Throws:** `SigningError`, `InitializationError`

---

#### **on()**

Registers an event listener for client-side events.

- **Parameters:**
  - `event`: `'sessionsUpdated' | 'signatureResponse'` - The event to listen for.
  - `listener`: `DappClientEventListener` - The callback function.
- **Returns:** `() => void` - A function to unsubscribe the listener.
- **Example:**
  ```typescript
  dappClient.on('signatureResponse', (data) => {
    if (data.error) {
      console.error('Signing failed:', data.error)
    } else {
      console.log('Signature received:', data.response.signature)
    }
  })
  ```
