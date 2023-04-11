// Deployed test details taken from tenderly-sdk tests
// https://github.com/Tenderly/tenderly-sdk/blob/67e4d5ae8d7fd84f02b1623b83b8ee21d5ecc959/test/contracts.repository.test.ts#L123
export const COUNTER_ADDR_SEPOLIA = '0x8AAF9071E6C3129653B2dC39044C3B79c0bFCfBF';

export const COUNTER_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
contract CounterWithLogs {
  uint public count;
  event CounterChanged(
    string method,
    uint256 oldNumber,
    uint256 newNumber,
    address caller
  );
  // Function to get the current count
  function get() public view returns (uint) {
    return count;
  }
  // Function to increment count by 1
  function inc() public {
    emit CounterChanged("Increment", count, count + 1, msg.sender);
    count += 1;
  }
  // Function to decrement count by 1
  function dec() public {
    emit CounterChanged("Decrement", count, count - 1, msg.sender);
    count -= 1;
  }
}
`;
