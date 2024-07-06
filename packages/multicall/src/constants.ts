export enum JsonRpcMethod {
  ethCall = 'eth_call',
  ethGetBalance = 'eth_getBalance',
  ethGetCode = 'eth_getCode', // not used in multicall3
  ethGetChainId = 'eth_chainId',
  ethBlockNumber = 'eth_blockNumber',
}
