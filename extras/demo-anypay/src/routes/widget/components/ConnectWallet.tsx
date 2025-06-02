import React from 'react'

interface ConnectWalletProps {
  onConnect: () => void
}

export const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect }) => {
  const handleConnect = () => {
    console.log('connected')
    onConnect()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Connect a Wallet</h2>
      <button
        onClick={handleConnect}
        className="w-full flex items-center justify-center space-x-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
      >
        <img
          src="https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg"
          alt="MetaMask"
          className="w-6 h-6"
        />
        <span>MetaMask</span>
      </button>
    </div>
  )
}

export default ConnectWallet
