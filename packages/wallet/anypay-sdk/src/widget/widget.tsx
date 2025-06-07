import { useState, useEffect, useContext } from 'react'
import { useAccount, http, createConfig, WagmiProvider, useConnect, Config } from 'wagmi'
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
import { createWalletClient, custom, TransactionReceipt, type WalletClient } from 'viem'
import { mainnet, base, optimism, arbitrum, Chain } from 'viem/chains'
import { parseUnits } from 'viem'
import * as chains from 'viem/chains'
import '@0xsequence/design-system/preset'
import './index.css'
import React from 'react'
import { DEFAULT_INDEXER_GATEWAY_URL, DEFAULT_API_URL, DEFAULT_ENV } from '../constants.js'
import { useIndexerGatewayClient } from '../indexerClient.js'
import { createConnector } from 'wagmi'
import { ConnectorNotFoundError } from 'wagmi'
import { getAddress } from 'viem'
import { WagmiContext } from 'wagmi'

type Screen = 'connect' | 'tokens' | 'send' | 'pending' | 'receipt'

const wagmiConfig1 = createConfig({
  autoConnect: true,
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
  env?: 'local' | 'cors-anywhere' | 'dev' | 'prod'
  toRecipient?: string
  toAmount?: string
  toChainId?: number | string
  toToken?: 'USDC' | 'ETH'
  toCalldata?: string
  provider?: any
  children?: React.ReactNode
  renderInline?: boolean
}

const queryClient = new QueryClient()

const WidgetInner = ({
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
}: AnyPayWidgetProps) => {
  const { address, isConnected, chainId } = useAccount()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<Screen>(isConnected ? 'tokens' : 'connect')
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [destinationTxHash, setDestinationTxHash] = useState('')
  const [destinationChainId, setDestinationChainId] = useState<number | null>(null)
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null)

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

  const handleSendAnother = () => {
    setCurrentScreen('tokens')
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setCurrentScreen('connect')
    setSelectedToken(null)
    setDestinationTxHash('')
    setDestinationChainId(null)
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

  const renderScreen = () => {
    return (
      <div className="flex flex-col min-h-[400px] bg-white rounded-2xl shadow-xl p-6 relative w-full max-w-md">
        {renderScreenInner()}
        <div className="mt-auto pt-4 text-center text-sm text-gray-500">
          Powered by <span className="font-medium text-black-500">AnyPay</span>
        </div>
      </div>
    )
  }

  const renderScreenInner = () => {
    switch (currentScreen) {
      case 'connect':
        return <ConnectWallet onConnect={handleConnect} />
      case 'tokens':
        return (
          <TokenList onContinue={handleTokenSelect} onBack={handleBack} indexerGatewayClient={indexerGatewayClient} />
        )
      case 'send':
        return selectedToken && walletClient?.account ? (
          <SendForm
            onSend={handleSend}
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
          />
        ) : null
      case 'pending':
        return <TransferPending onComplete={handleTransferComplete} />
      case 'receipt':
        return (
          <Receipt
            onSendAnother={handleSendAnother}
            onClose={handleCloseModal}
            txHash={destinationTxHash}
            chainId={destinationChainId!}
          />
        )
      default:
        return null
    }
  }

  if (renderInline) {
    return renderScreen()
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      {!children ? (
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 text-white hover:bg-blue-600 cursor-pointer font-semibold py-3 px-6 rounded-lg shadow-sm transition-colors"
        >
          Pay
        </button>
      ) : (
        <div className="flex flex-col items-center justify-center" onClick={() => setIsModalOpen(true)}>
          {children}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        {renderScreenInner()}
      </Modal>
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
