import React from 'react'
import { Link, useLocation } from 'react-router'

export const Header: React.FC = () => {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-blue-500 font-bold' : 'text-gray-600'
  }

  return (
    <header className="shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 ${
                  location.pathname === '/' ? 'border-blue-500' : 'border-transparent'
                } ${isActive('/')}`}
              >
                Home
              </Link>
              <Link
                to="/widget"
                className={`inline-flex items-center px-1 pt-1 border-b-2 ${
                  location.pathname === '/widget' ? 'border-blue-500' : 'border-transparent'
                } ${isActive('/widget')}`}
              >
                Widget
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Header
