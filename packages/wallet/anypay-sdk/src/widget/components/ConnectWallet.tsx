import React from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
// import MetaMaskFox from '../assets/MetaMask_Fox.svg'

interface ConnectWalletProps {
  onConnect: () => void
  theme?: 'light' | 'dark'
}

export const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect, theme = 'light' }) => {
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
        <h2 className={`text-lg font-semibold w-full text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Connect a Wallet
        </h2>
      </div>

      {isConnected ? (
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Connected with {connector?.name}</p>
            <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'} style={{ wordBreak: 'break-all' }}>
              {address}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={onConnect}
              className={`w-full cursor-pointer font-semibold py-3 px-4 rounded-[24px] transition-colors ${
                theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Continue
            </button>
            <button
              onClick={handleDisconnect}
              className={`w-full cursor-pointer font-semibold py-3 px-4 rounded-[24px] transition-colors border ${
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700'
                  : 'bg-white hover:bg-gray-50 text-gray-900 border-gray-200'
              }`}
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className={`w-full flex items-center justify-center space-x-2 cursor-pointer font-semibold py-3 px-4 rounded-[24px] transition-colors ${
            theme === 'dark'
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-orange-500 hover:bg-orange-600 text-white'
          }`}
        >
          {/* <img src={MetaMaskFox} alt="MetaMask" className="w-6 h-6" /> */}
          <span>MetaMask</span>
        </button>
      )}
    </div>
  )
}

export default ConnectWallet
