import { AbiFunction } from 'ox';
export function getERC20TransferData(recipient, amount) {
    const erc20Transfer = AbiFunction.from('function transfer(address,uint256) returns (bool)');
    return AbiFunction.encodeData(erc20Transfer, [recipient, amount]);
}
