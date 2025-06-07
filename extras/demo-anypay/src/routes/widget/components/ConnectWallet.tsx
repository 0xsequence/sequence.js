import { useEffect } from 'react'
import { createAppKit } from '@reown/appkit/react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { Chain } from 'viem'
import * as chains from 'viem/chains'

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

// Create modal
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true,
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
  useEffect(() => {
    // Listen for the appkit:connected event
    const handleAppKitConnected = (event: any) => {
      const { provider } = event.detail
      if (provider) {
        onConnect(provider)
      }
    }

    window.addEventListener('appkit:connected', handleAppKitConnected)

    return () => {
      window.removeEventListener('appkit:connected', handleAppKitConnected)
    }
  }, [onConnect])

  return (
    <div className="flex justify-center">
      <appkit-button />
    </div>
  )
}
