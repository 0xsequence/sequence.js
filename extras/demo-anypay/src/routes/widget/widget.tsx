import React, { useState } from 'react'
import Modal from './components/Modal'
import ConnectWallet from './components/ConnectWallet'
import TokenList from './components/TokenList'
import SendForm from './components/SendForm'
import TransferPending from './components/TransferPending'
import Receipt from './components/Receipt'

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

export const Widget: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<Screen>('connect')
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [txHash, setTxHash] = useState('')

  const handleConnect = () => {
    setCurrentScreen('tokens')
  }

  const handleTokenSelect = (token: Token) => {
    setSelectedToken(token)
    setCurrentScreen('send')
  }

  const handleSend = (amount: string, recipient: string) => {
    console.log('Sending', amount, recipient)
    setTxHash('0x123...') // Example transaction hash
    setCurrentScreen('pending')
  }

  const handleTransferComplete = () => {
    setCurrentScreen('receipt')
  }

  const handleSendAnother = () => {
    setCurrentScreen('tokens')
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    // Reset all state when modal is closed
    setCurrentScreen('connect')
    setSelectedToken(null)
    setTxHash('')
  }

  const handleBack = () => {
    // Handle back navigation based on current screen
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
        return selectedToken ? <SendForm onSend={handleSend} selectedToken={selectedToken} /> : null
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
