import React from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { ChevronLeft } from 'lucide-react'
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
      <div className="flex items-center relative">
        <h2 className="text-lg font-semibold text-gray-900 w-full text-center">Connect a Wallet</h2>
      </div>

      {isConnected ? (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-2xl">
            <p className="text-sm text-gray-500">Connected with {connector?.name}</p>
            <p className="text-gray-900 font-medium break-all">{address}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={onConnect}
              className="w-full bg-blue-500 hover:bg-gray-900 cursor-pointer text-white font-semibold py-3 px-4 rounded-[24px] transition-colors"
            >
              Continue
            </button>
            <button
              onClick={handleDisconnect}
              className="w-full bg-white hover:bg-gray-50 cursor-pointer text-gray-900 font-semibold py-3 px-4 rounded-[24px] transition-colors border border-gray-200"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full flex items-center justify-center space-x-2 bg-orange-500 hover:bg-orange-600 cursor-pointer text-white font-semibold py-3 px-4 rounded-[24px] transition-colors"
        >
          {/* <img src={MetaMaskFox} alt="MetaMask" className="w-6 h-6" /> */}
          <span>MetaMask</span>
        </button>
      )}
    </div>
  )
}

export default ConnectWallet
