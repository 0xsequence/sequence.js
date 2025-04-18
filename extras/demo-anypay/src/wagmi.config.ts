import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, polygon, arbitrum, optimism, base } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'
import { sequenceWallet } from '@0xsequence/wagmi-connector'

const projectAccessKey = import.meta.env.VITE_PROJECT_ACCESS_KEY

if (!projectAccessKey) {
  console.warn('VITE_PROJECT_ACCESS_KEY is not set in .env file. Sequence connector may not work correctly.')
}

export const config = createConfig({
  chains: [mainnet, sepolia, polygon, arbitrum, optimism, base],
  connectors: [
    sequenceWallet({
      connectOptions: {
        app: 'Demo Anypay',
        projectAccessKey: projectAccessKey,
      },
      defaultNetwork: mainnet.id,
    }),
    injected(),
    metaMask(),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
  },
})
