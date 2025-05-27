import { http, createConfig } from 'wagmi'
import * as chains from 'viem/chains'
import { injected, metaMask } from 'wagmi/connectors'
// import { sequenceWallet } from '@0xsequence/wagmi-connector'

const projectAccessKey = import.meta.env.VITE_PROJECT_ACCESS_KEY

if (!projectAccessKey) {
  console.warn('VITE_PROJECT_ACCESS_KEY is not set in .env file. Sequence connector may not work correctly.')
}

export const config = createConfig({
  // @ts-expect-error
  chains: Object.values(chains),
  connectors: [
    // sequenceWallet({
    //   connectOptions: {
    //     app: 'Demo Anypay',
    //     projectAccessKey: projectAccessKey,
    //   },
    //   defaultNetwork: chains.mainnet.id,
    // }),
    injected(),
    metaMask(),
  ],
  transports: Object.values(chains).reduce(
    (acc, chain) => ({
      ...acc,
      [chain.id]: http(),
    }),
    {},
  ) as Record<number, ReturnType<typeof http>>,
})
