# arcadeum.js
Javascript &amp; Typescript Client for Arcadeum Transaction Relayer

## Usage

```
import Contract from './src'

// ethers.js wallet that signs the meta-transaction
const signer = ...

// Abi of the contract
const abi = "[...]"

// Specific contract instance
const contract = new Contract(abi, "0x...")

// options for the meta-transaction (nonce, extra data and gas receipt)
// only nonce is mandatory
const opts: Opts = {
    nonce: 1,
}

// generate the input to be sent to the relayer
const input = await contract.call(opts, signer, "metaSafeTransferFrom", [...params])
```
