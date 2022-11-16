@0xsequence/multicall
=====================

An Ethereum provider wrapper that aggregates multiple operations in one, reducing the network load
on clients and servers. The project aims to be plug-and-play with existing ether.js integrations.

For more info see [0xsequence project page](https://github.com/0xsequence/sequence.js).

Inspired by MakerDAO [Multicall.js](https://github.com/makerdao/multicall.js).

## Installation

`yarn add @0xsequence/multicall`

or

`npm install --save @0xsequence/multicall`

## Usage

Sequence Multicall works by implementing `ethers.Provider` and wrapping an existing `ethers.Provider`; this
wrapped provider can transparently aggregate supported JSON-RPC calls.

```ts
import { providers } from '@0xsequence/multicall'
import { providers as ethersProviders } from 'ethers'

// MulticallProvider can wrap and extend with multicall functionality
// any ethers.js provider, it's not limited to JsonRpcProvider
const provider = new providers.MulticallProvider(new ethersProviders.JsonRpcProvider("https://cloudflare-eth.com/"))
```

### Making aggregated calls

Multicall leverages RPC calls' asynchronous nature to perform the aggregation; it implements a buffer
with a configurable 50ms delay and aggregates all operations received within that window.

Explicit usage of the functionality can be forced by making multiple calls using `Promise.all`.

```ts
// Both requests are aggregated into a single RPC call
const [balance, supply] = await Promise.all([
  provider.getBalance("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  dai.totalSupply()
])
```

Methods can also be aggregated without using `Promise.all`, as long as there are no `await` in between calls.

```ts
// DON'T
const balance = await provider.getBalance("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
const supply = await dai.totalSupply()

// DO
const balancePromise = provider.getBalance("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
const supplyPromise = dai.totalSupply()

const balance = await balancePromise
const supply = await supplyPromise
```

## Using the provider

The `MulticallProvider` instance can be used in any context where an ethers.Provider is expected, including
contract interfaces, middlewares, or libraries; all calls to the same provider are candidates for aggregation.

```ts
// Uses a single JSON-RPC call

const abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function symbol() view returns (string)",
]

const uni = new ethers.Contract("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", abi, provider)
const dai = new ethers.Contract("0x6B175474E89094C44Da98b954EedeAC495271d0F", abi, provider)

const uniTotalSupplyPromise = uni.totalSupply()

const [totalSupply, balance, daiSymbol, uniSymbol] = await Promise.all([
  dai.totalSupply(),
  dai.balanceOf("0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"),
  dai.symbol(),
  uni.symbol()
])

const uniTotalSupply = await uniTotalSupplyPromise
```


### Supported methods

The following JSON-RPC methods are supported for call aggregation:

--------------------------------------------------------------------------------------------------------------------
| Method          | Supported | Implemented | Notes                                                                |
|-----------------|-----------|-------------|----------------------------------------------------------------------|
| eth_call        | Yes       | Yes         | Requests containing `from`, `gasPrice` or `value` aren't aggregated. |
| eth_getBalance  | Yes       | Yes         |                                                                      |
| eth_getCode     | Yes       | Yes         |                                                                      |
| eth_blockNumber | Yes       | No          |                                                                      |
--------------------------------------------------------------------------------------------------------------------

All other RPC methods that are part of the standard are forwarded to the parent provider without any modifications.

> ⚠️ Using mixed blocktags will make some calls skip aggregation.


### Error handling

The multicall wrapper is designed to work with any exiting ether.js integration transparently; this includes error
handling for cases when multicall fails, is wrongly configured, or the contract does not support it.

JSON-RPC Calls are forwarded to the parent provider on any of the following cases:
- Multicall contract is not deployed on the given network
- Individual call fails (only failed calls are forwarded)
- Batch call fails (all calls are forwarded)
- Invalid RPC Call (invalid address, etc.)
- Mixed blocktags within a batch
- Unsupported special parameters (see supported methods)
- Unsupported method


## Configuration

The MulticallProvider comes with a pre-defined configuration; it's ready to work out-of-the-box on
the networks: Mainnet, Ropsten, Kovan, Rinkeby, Görli, and Matic (Mainnet).

```ts
DEFAULT_CONF = {
  batchSize: 50,
  timeWindow: 50, // ms
  contract: "0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E"
}
```
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
| Parameter  | Required | Description                                                                                                                                          |
|------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| batchSize  | Yes      | Defines the maximum number of calls to batch into a single JSON-RPC call.                                                                            |
| timeWindow | Yes      | Defines the time each call is held on buffer waiting for subsequent calls before aggregation, use 0 for "next js tick".                              |
| contract   | Yes      | Instance of MultiCallUtils contract, see: https://github.com/0xsequence/wallet-contracts/blob/master/src/contracts/modules/utils/MultiCallUtils.sol  |
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


### Supported networks

The utility contract is `0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E`, it has been deployed using an [Universal Deployer](https://gist.github.com/Agusx1211/de05dabf918d448d315aa018e2572031) and it uses the same address on all networks. It can be used on any of these chains without configuration changes.

------------------------------------------------------------------------------------
| Network                  | Address                                    | Deployed |
|:-------------------------|:-------------------------------------------|:---------|
| Mainnet                  | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| Görli                    | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| Ropsten                  | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| Rinkeby                  | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| Kovan                    | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| Polygon                  | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| Mumbai (Polygon testnet) | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| Arbitrum One             | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| Arbitrum testnet         | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| Arbitrum Görli testnet   | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| Avalanche                | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
| BSC                      | 0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E | Yes      |
------------------------------------------------------------------------------------

It can be deployed on any network that supports the `CREATE2` opcode. See https://blockscan.com/address/0xd130B43062D875a4B7aF3f8fc036Bc6e9D3E1B3E for live list.

