import { useState, useEffect, useContext } from 'react'
import { useAccount, http, createConfig, WagmiProvider } from 'wagmi'
import { SequenceHooksProvider } from '@0xsequence/hooks'
import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import Modal from './components/Modal.js'
import ConnectWallet from './components/ConnectWallet.js'
import TokenList from './components/TokenList.js'
import SendForm from './components/SendForm.js'
import TransferPending from './components/TransferPending.js'
import Receipt from './components/Receipt.js'
import { createWalletClient, custom, TransactionReceipt, type WalletClient } from 'viem'
import { mainnet, base, optimism, arbitrum } from 'viem/chains'
import * as chains from 'viem/chains'
import '@0xsequence/design-system/preset'
import './index.css'
import React from 'react'
import { useIndexerGatewayClient } from '../indexerClient.js'
import { WagmiContext } from 'wagmi'
import { TransactionState } from '../anypay.js'

type Screen = 'connect' | 'tokens' | 'send' | 'pending' | 'receipt'
type Theme = 'light' | 'dark' | 'auto'
type ActiveTheme = 'light' | 'dark'

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
  for (const chain of Object.values(chains) as any[]) {
    // TODO: add proper types
    if (chain.id === chainId) {
      return chain
    }
  }
  throw new Error(`Unsupported chain ID: ${chainId}`)
}

export type AnyPayWidgetProps = {
  sequenceApiKey: string
  indexerUrl?: string
  apiUrl?: string
  env?: 'local' | 'cors-anywhere' | 'dev' | 'prod'
  toRecipient?: string
  toAmount?: string
  toChainId?: number | string
  toToken?: 'USDC' | 'ETH'
  toCalldata?: string
  provider?: any
  children?: React.ReactNode
  renderInline?: boolean
  theme?: Theme
}

const queryClient = new QueryClient()

// Function to get system theme preference
const getSystemTheme = (): ActiveTheme => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Function to get initial theme based on mode
const getInitialTheme = (mode: Theme): ActiveTheme => {
  if (mode === 'auto') {
    return getSystemTheme()
  }
  return mode as ActiveTheme
}

const WidgetInner: React.FC<AnyPayWidgetProps> = ({
  sequenceApiKey,
  indexerUrl,
  apiUrl,
  env,
  toRecipient,
  toAmount,
  toChainId,
  toToken,
  toCalldata,
  provider,
  children,
  renderInline,
  theme: initialTheme = 'auto',
}) => {
  const { address, isConnected, chainId } = useAccount()
  const [theme, setTheme] = useState<ActiveTheme>(getInitialTheme(initialTheme))
  const [themeMode, setThemeMode] = useState<Theme>(initialTheme)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<Screen>(isConnected ? 'tokens' : 'connect')
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [destinationTxHash, setDestinationTxHash] = useState('')
  const [destinationChainId, setDestinationChainId] = useState<number | null>(null)
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [transactionStates, setTransactionStates] = useState<TransactionState[]>([])

  // Update theme when system preference changes
  useEffect(() => {
    if (themeMode !== 'auto') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light')
    }

    // Set initial value
    setTheme(mediaQuery.matches ? 'dark' : 'light')

    // Add listener for changes
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode])

  // Update theme when prop changes
  useEffect(() => {
    setThemeMode(initialTheme)
    setTheme(getInitialTheme(initialTheme))
  }, [initialTheme])

  // Set up wallet client when connected
  useEffect(() => {
    if (provider && address && chainId) {
      const chain = getChainConfig(chainId)
      const client = createWalletClient({
        account: address,
        chain,
        transport: custom(provider),
      })
      setWalletClient(client)
    }
  }, [provider, address, chainId])

  // Update screen based on connection state
  useEffect(() => {
    if (isConnected) {
      setCurrentScreen('tokens')
    }
  }, [isConnected])

  const indexerGatewayClient = useIndexerGatewayClient({
    indexerGatewayUrl: indexerUrl,
    projectAccessKey: sequenceApiKey,
  })

  const handleConnect = () => {
    if (walletClient && !isConnected) {
      const connect = async () => {
        await walletClient.request({ method: 'eth_requestAccounts' })
      }
      connect()
    } else if (isConnected) {
      setCurrentScreen('tokens')
    }
  }

  const handleTokenSelect = (token: Token) => {
    try {
      setError(null)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    }
  }

  const handleOnSend = async (amount: string, recipient: string) => {
    console.log('handleOnSend', amount, recipient)
  }

  const handleSendAnother = () => {
    setCurrentScreen('tokens')
    resetState()
  }

  function resetState() {
    setCurrentScreen('connect')
    setSelectedToken(null)
    setDestinationTxHash('')
    setDestinationChainId(null)
    setTransactionStates([])
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    resetState()
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
        setDestinationTxHash('')
        setDestinationChainId(null)
        break
      default:
        break
    }
  }

  function handleTransferComplete(data?: {
    originChainId: number
    destinationChainId: number
    originUserTxReceipt: TransactionReceipt
    originMetaTxnReceipt: any
    destinationMetaTxnReceipt: any
  }) {
    if (data) {
      setDestinationTxHash(data.destinationMetaTxnReceipt?.txnHash || data.originUserTxReceipt.transactionHash)
      setDestinationChainId(data.destinationChainId)
      setCurrentScreen('receipt')
    }
  }

  function handleTransactionStateChange(_transactionStates: TransactionState[]) {
    console.log('transactionStates from widget', _transactionStates)
    setTransactionStates([..._transactionStates])
  }

  const renderScreenContent = () => {
    switch (currentScreen) {
      case 'connect':
        return <ConnectWallet onConnect={handleConnect} theme={theme} />
      case 'tokens':
        return (
          <TokenList
            onContinue={handleTokenSelect}
            onBack={handleBack}
            indexerGatewayClient={indexerGatewayClient}
            theme={theme}
          />
        )
      case 'send':
        return selectedToken && walletClient?.account ? (
          <SendForm
            onSend={handleOnSend}
            onBack={handleBack}
            onConfirm={() => setCurrentScreen('pending')}
            onComplete={handleTransferComplete}
            selectedToken={selectedToken}
            account={walletClient.account}
            sequenceApiKey={sequenceApiKey}
            apiUrl={apiUrl}
            env={env}
            toRecipient={toRecipient}
            toAmount={toAmount}
            toChainId={toChainId ? Number(toChainId) : undefined}
            toToken={toToken}
            toCalldata={toCalldata}
            walletClient={walletClient}
            theme={theme}
            onTransactionStateChange={handleTransactionStateChange}
          />
        ) : null
      case 'pending':
        return (
          <TransferPending onComplete={handleTransferComplete} theme={theme} transactionStates={transactionStates} />
        )
      case 'receipt':
        return (
          <Receipt
            onSendAnother={handleSendAnother}
            onClose={handleCloseModal}
            txHash={destinationTxHash}
            chainId={destinationChainId!}
            theme={theme}
          />
        )
      default:
        return null
    }
  }

  const renderScreen = () => {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 30,
          mass: 1,
        }}
        className={`flex flex-col min-h-[400px] rounded-[32px] shadow-xl p-6 relative w-[400px] mx-auto ${
          theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
        }`}
        layout
        layoutId="modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
              mass: 0.6,
            }}
            className="flex-1 flex flex-col w-full"
            layout
          >
            {renderScreenContent()}
            {error && (
              <div
                className={`border rounded-lg p-4 mt-4 ${
                  theme === 'dark' ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
                }`}
              >
                <p className={`text-sm break-words ${theme === 'dark' ? 'text-red-200' : 'text-red-600'}`}>{error}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className={`mt-auto pt-4 text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
          layout
        >
          Powered by{' '}
          <a
            href="https://anypay.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className={`font-medium transition-colors hover:underline ${
              theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'
            }`}
          >
            AnyPay
          </a>
        </motion.div>
      </motion.div>
    )
  }

  if (renderInline) {
    return renderScreen()
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      {!children ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsModalOpen(true)}
          className={`${
            theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
          } text-white cursor-pointer font-semibold py-3 px-6 rounded-[24px] shadow-sm transition-colors`}
        >
          Pay
        </motion.button>
      ) : (
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex flex-col items-center justify-center"
          onClick={() => setIsModalOpen(true)}
        >
          {children}
        </motion.div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <Modal isOpen={isModalOpen} onClose={handleCloseModal} theme={theme}>
            {renderScreen()}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

export const AnyPayWidget = (props: AnyPayWidgetProps) => {
  const wagmiContext = useContext(WagmiContext)
  const config = React.useMemo(
    () =>
      createConfig({
        chains: [mainnet],
        transports: Object.values(chains as unknown as any[]).reduce(
          (acc, chain) => ({
            ...acc,
            [chain.id]: custom(props.provider),
          }),
          {},
        ) as Record<number, ReturnType<typeof http>>,
      }),
    [props.provider],
  )

  const content = (
    <QueryClientProvider client={queryClient}>
      <SequenceHooksProvider
        config={{
          projectAccessKey: props.sequenceApiKey,
          env: {
            indexerUrl: props.indexerUrl,
            indexerGatewayUrl: props.indexerUrl,
            apiUrl: props.apiUrl,
          },
        }}
      >
        <WidgetInner {...props} />
      </SequenceHooksProvider>
    </QueryClientProvider>
  )

  // If no parent Wagmi context, provide our own
  if (!wagmiContext) {
    return (
      <StrictMode>
        <WagmiProvider config={config}>{content}</WagmiProvider>
      </StrictMode>
    )
  }

  // Otherwise use parent context
  return <StrictMode>{content}</StrictMode>
}

export default AnyPayWidget
