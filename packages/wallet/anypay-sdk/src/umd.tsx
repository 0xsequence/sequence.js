import React from 'react'
import { createRoot } from 'react-dom/client'
import { AnyPayWidget } from './widget/widget.js'

interface AnyPayGlobal {
  render: (
    element: HTMLElement,
    options: {
      sequenceApiKey: string
      indexerUrl?: string
      apiUrl?: string
      env?: 'local' | 'cors-anywhere' | 'dev' | 'prod'
      toRecipient?: string
      toAmount?: string
      toChainId?: number | string
      toToken?: 'USDC' | 'ETH'
      toCalldata?: string
      theme?: 'light' | 'dark' | 'auto'
    },
  ) => void
}

const AnyPayGlobal: AnyPayGlobal = {
  render: (element, options) => {
    const root = createRoot(element)
    root.render(
      <React.StrictMode>
        <AnyPayWidget {...options} />
      </React.StrictMode>,
    )
  },
}

// Export for both UMD and ESM/CJS
export default AnyPayGlobal

// Explicitly set the global for UMD
if (typeof window !== 'undefined') {
  ;(window as any).AnyPayWidget = AnyPayGlobal
}

// Add type declaration for window object
declare global {
  interface Window {
    AnyPayWidget: AnyPayGlobal
  }
}
