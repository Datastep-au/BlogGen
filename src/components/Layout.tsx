import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, PlusCircle, LogOut, User, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <img 
                  src="/BlogGen_Pro_Logo.png" 
                  alt="BlogGen Pro" 
                  className="h-16 sm:h-20 md:h-24 w-auto"
                />
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:ml-8 md:flex md:space-x-8">
                <NavLink
                  to="/app"
                  end
                  className={({ isActive }) =>
                    `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`
                  }
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Generate
                </NavLink>
                <NavLink
                  to="/app/dashboard"
                  className={({ isActive }) =>
                    `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`
                  }
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Dashboard
                </NavLink>
              </div>
            </div>
            
            {/* Desktop User Menu */}
            <div className="hidden md:flex md:items-center md:space-x-4">
              <div className="flex items-center text-sm text-gray-700">
                <User className="h-4 w-4 mr-2" />
                <span className="hidden lg:inline">{user?.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1" />
                <span className="hidden lg:inline">Sign Out</span>
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
              <NavLink
                to="/app"
                end
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                <PlusCircle className="h-5 w-5 mr-3" />
                Generate
              </NavLink>
              <NavLink
                to="/app/dashboard"
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                <BarChart3 className="h-5 w-5 mr-3" />
                Dashboard
              </NavLink>
              
              {/* Mobile user info and sign out */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center px-3 py-2">
                  <User className="h-5 w-5 mr-3 text-gray-400" />
                  <span className="text-sm text-gray-600 truncate">{user?.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
      
      <main className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}