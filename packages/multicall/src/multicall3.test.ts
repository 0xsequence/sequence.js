import { Contract, providers } from 'ethers';
import { test, expect } from 'vitest';
import { MulticallProvider } from './providers';

test('multicall3', { retry: 0 }, async () => {
    const transport = new providers.JsonRpcProvider('https://eth.llamarpc.com');

    const provider = new MulticallProvider(transport, {
        contract: '0xcA11bde05977b3631167028862bE2a173976CA11',
        verbose: false
    });

    const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)"
    ];

    const usdc = new Contract('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', erc20Abi, provider);


    const results = await Promise.allSettled([
        provider.getBlockNumber(),
        provider.getBalance("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
        usdc.getBalance('0x1000000000000000000100000000000000000000'),
        usdc.getBalance('0x2000000000000000000000000000000000000001'),
        usdc.getBalance('0x3000000000000000000000000000000000000003'),
        usdc.getBalance('0x4000000000000000000000000000000000000004'),
    ])

    for (const result of results) {
        expect(result.status).to.equal('fulfilled');
    }

})