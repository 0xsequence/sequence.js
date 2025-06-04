import { Outlet } from 'react-router'
import { Header } from '../components/Header'

export const RootLayout = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="py-10">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
