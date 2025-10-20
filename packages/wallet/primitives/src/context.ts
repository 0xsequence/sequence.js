import { Address, Hex } from 'ox'

export type Capabilities = {
  erc4337?: {
    entrypoint: Address.Address
  }
}

export type Context = {
  factory: Address.Address
  stage1: Address.Address
  stage2: Address.Address
  creationCode: Hex.Hex
  capabilities?: Capabilities
}

export const Dev1: Context = {
  factory: '0xe828630697817291140D6B7A42a2c3b7277bE45a',
  stage1: '0x2a4fB19F66F1427A5E363Bf1bB3be27b9A9ACC39',
  stage2: '0xe1299E4456b267123F7Aba29B72C2164ff501BDa',
  creationCode: '0x603e600e3d39601e805130553df33d3d34601c57363d3d373d363d30545af43d82803e903d91601c57fd5bf3',
}

export const Dev2: Context = {
  factory: '0xFE14B91dE3c5Ca74c4D24608EBcD4B2848aA6010',
  stage1: '0x300E98ae5bEA4A7291d62Eb0b9feD535E10095dD',
  stage2: '0x90cb0a8ccf40bEdA60896e408bdc7801033447C6',
  creationCode: '0x6041600e3d396021805130553df33d3d36153402601f57363d3d373d363d30545af43d82803e903d91601f57fd5bf3',
}

export const Dev2_4337: Context = {
  factory: '0xFE14B91dE3c5Ca74c4D24608EBcD4B2848aA6010',
  stage1: '0x8Ae58FCc0Ee9b32994CA52c9854deb969DC8fa2A',
  stage2: '0x30f8e3AceAcDEac8a3F28935D87FD58DC5f71ad2',
  creationCode: '0x6041600e3d396021805130553df33d3d36153402601f57363d3d373d363d30545af43d82803e903d91601f57fd5bf3',
  capabilities: {
    erc4337: {
      entrypoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    },
  },
}

export const Rc3: Context = {
  factory: '0x00000000000018A77519fcCCa060c2537c9D6d3F',
  stage1: '0x00000000000084fA81809Dd337311297C5594d62',
  stage2: '0x7438718F9E4b9B834e305A620EEeCf2B9E6eBE79',
  creationCode: '0x6041600e3d396021805130553df33d3d36153402601f57363d3d373d363d30545af43d82803e903d91601f57fd5bf3',
}

export const Rc3_4337: Context = {
  factory: '0x00000000000018A77519fcCCa060c2537c9D6d3F',
  stage1: '0x0000000000005A02E3218e820EA45102F84A35C7',
  stage2: '0x7706aaC0cc2C42C01CE17136F7475b0E46F2ABA1',
  creationCode: '0x6041600e3d396021805130553df33d3d36153402601f57363d3d373d363d30545af43d82803e903d91601f57fd5bf3',
  capabilities: {
    erc4337: {
      entrypoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    },
  },
}

export type KnownContext = Context & {
  name: string
  development: boolean
}

export const KnownContexts: KnownContext[] = [
  { name: 'Dev1', development: true, ...Dev1 },
  { name: 'Dev2', development: true, ...Dev2 },
  { name: 'Dev2_4337', development: true, ...Dev2_4337 },
  { name: 'Rc3', development: true, ...Rc3 },
  { name: 'Rc3_4337', development: true, ...Rc3_4337 },
]

export function isContext(context: any): context is Context {
  return (
    (context as Context).factory !== undefined &&
    (context as Context).stage1 !== undefined &&
    (context as Context).stage2 !== undefined &&
    (context as Context).creationCode !== undefined
  )
}

export function isKnownContext(context: Context): context is KnownContext {
  return (context as KnownContext).name !== undefined && (context as KnownContext).development !== undefined
}
