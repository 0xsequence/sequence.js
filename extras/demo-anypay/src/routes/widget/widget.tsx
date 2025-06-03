import { useState } from 'react'
import { useAccount } from 'wagmi'
import Modal from './components/Modal'
import ConnectWallet from './components/ConnectWallet'
import TokenList from './components/TokenList'
import SendForm from './components/SendForm'
import TransferPending from './components/TransferPending'
import Receipt from './components/Receipt'
import { prepareSend } from '@anypay/sdk'
import { createWalletClient, custom, type WalletClient } from 'viem'
import { mainnet, base, optimism, arbitrum } from 'viem/chains'
import { parseUnits } from 'viem'

type Screen = 'connect' | 'tokens' | 'send' | 'pending' | 'receipt'

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

export const Widget = () => {
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
    if (!address || !isConnected || !chainId || !selectedToken || !window.ethereum || !walletClient?.account) return

    try {
      const options = {
        account: walletClient.account,
        originTokenAddress: selectedToken.contractAddress,
        originChainId: selectedToken.chainId,
        originTokenAmount: selectedToken.balance,
        destinationChainId: chainId,
        recipient,
        destinationTokenAddress: selectedToken.contractAddress,
        destinationTokenAmount: amount,
        sequenceApiKey: import.meta.env.VITE_SEQUENCE_API_KEY as string,
        fee: selectedToken.symbol === 'ETH' ? parseUnits('0.0001', 18).toString() : parseUnits('0.02', 6).toString(),
        client: walletClient,
      }

      const { intentAddress, send } = await prepareSend(options)
      console.log('Intent address:', intentAddress.toString())
      await send()

      setTxHash('0x123...')
      setCurrentScreen('receipt')
    } catch (error) {
      console.error('Error in prepareSend:', error)
      setCurrentScreen('send')
    }
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
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="text-center space-y-6 max-w-2xl px-4">
        <h1 className="text-4xl font-extrabold text-gray-200">Anypay Transfer Demo</h1>
        <p className="text-xl text-gray-200">
          This demo showcases a multi-step transfer flow using the Anypay SDK. Connect your wallet, select a token,
          specify the amount and recipient, and see the transaction confirmation process in action.
        </p>
      </div>

      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-500 text-white hover:bg-blue-600 font-semibold py-3 px-6 rounded-lg shadow-sm transition-colors"
      >
        Start Transfer
      </button>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        {renderScreen()}
      </Modal>
    </div>
  )
}

export default Widget
