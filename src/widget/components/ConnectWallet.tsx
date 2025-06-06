import React from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
// import MetaMaskFox from '../assets/MetaMask_Fox.svg'

interface ConnectWalletProps {
  onConnect: () => void
}

export const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect }) => {
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { isConnected, address, connector } = useAccount()

  const handleConnect = async () => {
    try {
      await connect({ connector: injected() })
      console.log('Connected to MetaMask')
    } catch (error) {
      console.error('Failed to connect:', error)
    }
  }

  const handleDisconnect = () => {
    disconnect()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Connect a Wallet</h2>

      {isConnected ? (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Connected with {connector?.name}</p>
            <p className="text-gray-900 font-medium break-all">{address}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={onConnect}
              className="w-full bg-blue-500 hover:bg-blue-600 cursor-pointer text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Continue
            </button>
            <button
              onClick={handleDisconnect}
              className="w-full bg-white hover:bg-gray-50 cursor-pointer text-gray-900 font-semibold py-3 px-4 rounded-lg transition-colors border border-gray-200"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full flex items-center justify-center space-x-2 bg-orange-500 hover:bg-orange-600 cursor-pointer text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {/* <img src={MetaMaskFox} alt="MetaMask" className="w-6 h-6" /> */}
          <span>MetaMask</span>
        </button>
      )}
    </div>
  )
}

export default ConnectWallet
