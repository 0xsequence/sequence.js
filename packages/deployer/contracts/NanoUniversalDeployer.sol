pragma solidity ^0.7.6;

contract NanoUniversalDeployer {
    event Deploy(address _addr) anonymous;

    fallback() external payable {
        address addr;
        bytes memory code = msg.data;
        assembly { addr := create2(callvalue(), add(code, 32), mload(code), 0) }
        emit Deploy(addr);
    }
}