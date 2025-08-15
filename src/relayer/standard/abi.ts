import { AbiFunction } from 'ox'

// ERC20 ABI functions
export const erc20BalanceOf = AbiFunction.from('function balanceOf(address) returns (uint256)')
export const erc20Allowance = AbiFunction.from('function allowance(address,address) returns (uint256)')

// ERC721 ABI functions
export const erc721OwnerOf = AbiFunction.from('function ownerOf(uint256) returns (address)')
export const erc721GetApproved = AbiFunction.from('function getApproved(uint256) returns (address)')

// ERC1155 ABI functions
export const erc1155BalanceOf = AbiFunction.from('function balanceOf(address,uint256) returns (uint256)')
export const erc1155IsApprovedForAll = AbiFunction.from('function isApprovedForAll(address,address) returns (bool)')
