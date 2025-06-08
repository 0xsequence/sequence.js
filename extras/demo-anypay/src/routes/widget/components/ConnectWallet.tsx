import { useEffect } from 'react'
import { createAppKit, useAppKitAccount, useWalletInfo } from '@reown/appkit/react'
import { WagmiProvider, injected, useConnect } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { Chain } from 'viem'
import * as chains from 'viem/chains'
import { useAppKitEvents } from '@reown/appkit/react'
import { reconnect } from '@wagmi/core'

// Setup queryClient
const queryClient = new QueryClient()

// Get projectId
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID

// Create metadata object
const metadata = {
  name: 'AnyPay Demo',
  description: 'AnyPay Widget Demo',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  icons: ['https://sequence.xyz/favicon.ico'],
}

// Set networks
const networks: [Chain, ...Chain[]] = [chains.mainnet, ...Object.values(chains)]

// Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
})

// Create AppKit instance
const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: false,
  },
})

// Export AppKit Provider component
export function AppKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

interface ConnectButtonProps {
  onConnect: (provider: any) => void
}

// Export ConnectButton component
export function ConnectButton({ onConnect }: ConnectButtonProps) {
  const events = useAppKitEvents()
  const { connectors } = useConnect()
  const account = useAppKitAccount()
  const { walletInfo } = useWalletInfo()

  useEffect(() => {
    // Check if already connected on mount
    if (events.data?.event === 'INITIALIZE') {
      const checkConnection = async () => {
        console.log('account', account)

        try {
          const connectedType = localStorage.getItem('anypay-connected')
          console.log('connectedType', connectedType)
          if (connectedType) {
            console.log('anypay-connected')
            const provider = await appKit.getProvider('eip155')

            const accounts = await (provider as any).request({ method: 'eth_accounts' })
            console.log('accounts', accounts)

            console.log('provider', provider)
            console.log('connectors', connectors)
            if (connectedType === 'injected') {
              reconnect(wagmiAdapter.wagmiConfig, { connectors: [injected()] })
            }
            if (provider) {
              onConnect(provider)
            }
          }
        } catch (error) {
          console.log('No existing connection found:', error)
          localStorage.removeItem('anypay-connected')
        }
      }
      checkConnection()
    }
    if (events.data?.event === 'CONNECT_SUCCESS') {
      console.log('connect', walletInfo)
      localStorage.setItem('anypay-connected', walletInfo?.type?.toLocaleLowerCase() || 'unknown')
    }

    if (events.data?.event === 'DISCONNECT_SUCCESS') {
      console.log('disconnect')
      localStorage.removeItem('anypay-connected')
    }
  }, [onConnect, events.data, walletInfo])

  return (
    <div className="flex justify-center">
      <appkit-button balance="hide" />
    </div>
  )
}
