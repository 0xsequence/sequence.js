import { Address, Hex } from 'ox'

export type Context = {
  factory: Address.Address
  stage1: Address.Address
  stage2: Address.Address
  creationCode: Hex.Hex
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
