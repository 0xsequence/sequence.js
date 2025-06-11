import { Address, AbiFunction } from 'ox'
import { Hex } from 'viem'

export function getERC20TransferData(recipient: string, amount: bigint): Hex {
  const erc20Transfer = AbiFunction.from('function transfer(address,uint256) returns (bool)')
  return AbiFunction.encodeData(erc20Transfer, [recipient as Address.Address, amount]) as Hex
}
