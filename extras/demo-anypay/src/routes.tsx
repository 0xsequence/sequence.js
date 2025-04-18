import { createBrowserRouter } from 'react-router'
import { ErrorRoute } from './routes/error'
import { RootLayout } from './routes/root-layout'
import { HomeIndexRoute } from './routes/home/home-index-route'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: ErrorRoute,
    children: [
      {
        index: true,
        Component: HomeIndexRoute,
      },
    ],
  },
])
