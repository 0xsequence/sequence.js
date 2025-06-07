import React from 'react'
import { Link, useLocation } from 'react-router'

export const Header: React.FC = () => {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <header className="bg-gray-900">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center h-16">
          <div className="flex items-center space-x-1">
            <Link
              to="/"
              className={`px-8 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive('/')
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Demo
            </Link>
            <Link
              to="/widget"
              className={`px-8 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive('/widget')
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Widget
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Header
