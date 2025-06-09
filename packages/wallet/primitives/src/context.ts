import { Address, Hex } from 'ox'

export type Context = {
  factory: Address.Address
  stage1: Address.Address
  stage2: Address.Address
  creationCode: Hex.Hex
}

export const Dev1: Context = {
  factory: '0xe068ec288d8b4Aaf7F7FC028Ce0797a7a353EF2d',
  stage1: '0x302608CcdCc540761A0ec89C9d8Fa195dc8049C6',
  stage2: '0x80cF586AFaCb3Cae77d84aFEBcC92382eDCF3A02',
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
  stage1: '0x6AaBb3125aEd6a95B23f3A15d4307E9469C77A5F',
  stage2: '0xC0De844908fe4e74aE4f9069CbD179F49b9A6065',
  creationCode: '0x6041600e3d396021805130553df33d3d36153402601f57363d3d373d363d30545af43d82803e903d91601f57fd5bf3',
}
