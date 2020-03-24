# arcadeum.js

Javascript &amp; Typescript Client for Arcadeum Transaction Relayer

## Usage

```
import Contract from './src'

// ethers.js wallet that signs the meta-transaction
const signer = ...

// address of meta tx compliant contract
const contractAddress = ""0x...""

// Specific contract instance
const encoder = new ERC1155MetaEncoder(contractAddress)

// options for the meta-transaction (nonce, extra data and gas receipt)
// only nonce is mandatory
const opts: Opts = {
    nonce: 1,
}

// generate the input to be sent to the relayer
const input = await encoder.encode(
    'metaSafeTransferFrom',
    signer,
    opts,
    [...params])
```
