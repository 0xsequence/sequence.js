import { useState } from 'react'
import { useAccount, http, createConfig, WagmiProvider } from 'wagmi'
import { SequenceHooksProvider } from '@0xsequence/hooks'
import { injected, metaMask } from 'wagmi/connectors'
import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Modal from './components/Modal.js'
import ConnectWallet from './components/ConnectWallet.js'
import TokenList from './components/TokenList.js'
import SendForm from './components/SendForm.js'
import TransferPending from './components/TransferPending.js'
import Receipt from './components/Receipt.js'
import { prepareSend } from '../anypay.js'
import { createWalletClient, custom, type WalletClient } from 'viem'
import { mainnet, base, optimism, arbitrum } from 'viem/chains'
import { parseUnits } from 'viem'
import * as chains from 'viem/chains'
import '@0xsequence/design-system/preset'
import './index.css'
import React from 'react'

type Screen = 'connect' | 'tokens' | 'send' | 'pending' | 'receipt'

const wagmiConfig = createConfig({
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
  transports: Object.values(chains as unknown as any[]).reduce(
    (acc, chain) => ({
      ...acc,
      [chain.id]: http(),
    }),
    {},
  ) as Record<number, ReturnType<typeof http>>,
})

interface Token {
  id: number
  name: string
  symbol: string
  balance: string
  imageUrl: string
  chainId: number
  contractAddress: string
  contractInfo?: {
    decimals: number
    symbol: string
    name: string
  }
}

const getChainConfig = (chainId: number) => {
  switch (chainId) {
    case 1:
      return mainnet
    case 8453:
      return base
    case 10:
      return optimism
    case 42161:
      return arbitrum
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`)
  }
}

export type AnyPayWidgetProps = {
  sequenceApiKey: string
  indexerUrl?: string
  apiUrl?: string
}

const queryClient = new QueryClient()

export const AnyPayWidget = ({ sequenceApiKey, indexerUrl, apiUrl }: AnyPayWidgetProps) => {
  const { address, isConnected, chainId } = useAccount()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<Screen>('connect')
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [txHash, setTxHash] = useState('')
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null)

  const handleConnect = () => {
    if (window.ethereum && address && chainId) {
      const chain = getChainConfig(chainId)
      const client = createWalletClient({
        account: address,
        chain,
        transport: custom(window.ethereum),
      })
      setWalletClient(client)
    }
    setCurrentScreen('tokens')
  }

  const handleTokenSelect = (token: Token) => {
    if (window.ethereum && address) {
      const chain = getChainConfig(token.chainId)
      const client = createWalletClient({
        account: address,
        chain,
        transport: custom(window.ethereum),
      })
      setWalletClient(client)
    }
    setSelectedToken(token)
    setCurrentScreen('send')
  }

  const handleSend = async (amount: string, recipient: string) => {
    console.log('handleSend', amount, recipient)
  }

  const handleTransferComplete = () => {
    setCurrentScreen('receipt')
  }

  const handleSendAnother = () => {
    setCurrentScreen('tokens')
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setCurrentScreen('connect')
    setSelectedToken(null)
    setTxHash('')
  }

  const handleBack = () => {
    switch (currentScreen) {
      case 'tokens':
        setCurrentScreen('connect')
        break
      case 'send':
        setCurrentScreen('tokens')
        setSelectedToken(null)
        break
      case 'receipt':
        setCurrentScreen('tokens')
        setSelectedToken(null)
        setTxHash('')
        break
      default:
        break
    }
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'connect':
        return <ConnectWallet onConnect={handleConnect} />
      case 'tokens':
        return <TokenList onContinue={handleTokenSelect} onBack={handleBack} />
      case 'send':
        return selectedToken && walletClient?.account ? (
          <SendForm
            onSend={handleSend}
            onBack={handleBack}
            onConfirm={() => setCurrentScreen('pending')}
            onComplete={() => setCurrentScreen('receipt')}
            selectedToken={selectedToken}
            account={walletClient.account}
            sequenceApiKey={sequenceApiKey}
          />
        ) : null
      case 'pending':
        return <TransferPending onComplete={handleTransferComplete} />
      case 'receipt':
        return <Receipt onSendAnother={handleSendAnother} onClose={handleCloseModal} txHash={txHash} />
      default:
        return null
    }
  }

  return (
    <StrictMode>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <SequenceHooksProvider
            config={{
              projectAccessKey: sequenceApiKey,
              env: {
                indexerUrl: indexerUrl,
                indexerGatewayUrl: indexerUrl,
                apiUrl: apiUrl,
              },
            }}
          >
            <div className="flex flex-col items-center justify-center space-y-8 py-12">
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-500 text-white hover:bg-blue-600 cursor-pointer font-semibold py-3 px-6 rounded-lg shadow-sm transition-colors"
              >
                Pay
              </button>

              <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                {renderScreen()}
              </Modal>
            </div>
          </SequenceHooksProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </StrictMode>
  )
}

export default AnyPayWidget
