# @0xsequence/deployer

Deploy contracts using a universal deployer via CREATE2, allowing contracts to have the same address on any EVM chain.

UniversalDeployer works in both Web Browsers and Nodejs.

For more info, see [0xsequence project page](https://github.com/0xsequence/sequence.js).

# How to use

1. `yarn add @0xsequence/deployer`
2. Import UniversalDeployer into script
3. Create UniversalDeployer instance
4. Deploy contracts

An `instance` number can be passed if multiple instance of the same contract need to be deployed on the same chain. The default instance number is 0, if none is passed.

```typescript
...
import { UniversalDeployer } from '@0xsequence/deployer'

const provider = new Web3Provider(web3.currentProvider)
const universalDeployer = new UniversalDeployer(network.name, provider)

const main = async () => {
  await universalDeployer.deploy('Factory', FactoryFactory)
  await universalDeployer.deploy('MainModuleUpgradable', MainModuleUpgradableFactory)
  await universalDeployer.deploy('GuestModule', GuestModuleFactory)

  prompt.start(`writing deployment information to ${network.name}.json`)
  await universalDeployer.registerDeployment()

  // or, await universalDeployer.getDeployment()

  prompt.succeed()
}

main()
```

You can also pass transaction parameters explicitly :

```typescript
...

const main = async () => {
  await universalDeployer.deploy('WalletFactory', FactoryFactory, { gasLimit: 1000000 })
  await universalDeployer.deploy('MainModuleUpgradable', MainModuleUpgradableFactory, { gasPrice: 10n ** 9n })
}

```

---

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Copyright (c) 2018-present Horizon Blockchain Games Inc.
