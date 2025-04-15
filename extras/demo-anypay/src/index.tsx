import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { SequenceHooksProvider } from '@0xsequence/hooks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider as JotaiProvider } from 'jotai'
import { router } from './routes'

import { globalStore } from './store'

import './index.css'
import { ThemeProvider } from '@0xsequence/design-system'
import { config } from './wagmi.config'
import { WagmiProvider } from 'wagmi'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={globalStore}>
          <SequenceHooksProvider
            config={{
              projectAccessKey: import.meta.env.VITE_PROJECT_ACCESS_KEY,
              env: {
                indexerUrl: 'https://indexer.sequence.app',
                // indexerUrl: 'https://dev-indexer.sequence.app',
                // indexerUrl:
                //   import.meta.env.VITE_ENV === 'local'
                //     ? 'http://localhost:7777'
                //     : import.meta.env.VITE_ENV === 'cors-anywhere'
                //       ? 'http://localhost:8080/https://dev-indexer.sequence.app'
                //       : import.meta.env.VITE_ENV === 'dev'
                //         ? 'https://dev-indexer.sequence.app'
                //         : 'https://indexer.sequence.app',
                apiUrl:
                  import.meta.env.VITE_ENV === 'local'
                    ? 'http://localhost:4422'
                    : import.meta.env.VITE_ENV === 'cors-anywhere'
                      ? 'http://localhost:8080/https://dev-api.sequence.app'
                      : import.meta.env.VITE_ENV === 'dev'
                        ? 'https://dev-api.sequence.app'
                        : 'https://api.sequence.app',
              },
            }}
          >
            <ThemeProvider>
              <RouterProvider router={router} />
            </ThemeProvider>
          </SequenceHooksProvider>
        </JotaiProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
