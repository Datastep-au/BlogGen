import { Link, useLocation } from 'wouter';
import { PlusCircle, LayoutDashboard, LogOut, User, Shield, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [location] = useLocation();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user role
    if (user) {
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          setUserRole(data.role || 'client_editor');
        })
        .catch(() => {
          setUserRole('client_editor');
        });
    }
  }, [user]);

  const isActive = (path: string) => {
    if (path === '/app' && location === '/app') return true;
    if (path !== '/app' && location === path) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 fixed w-full z-50 top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex-shrink-0 flex items-center">
                <img 
                  src="/BlogGen_Pro_Logo.png" 
                  alt="BlogGen Pro" 
                  className="w-28 h-28"
                />
              </div>
              <div className="flex items-center space-x-6">
                <Link
                  to="/app"
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                    isActive('/app')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Generate
                </Link>
                <Link
                  to="/app/dashboard"
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                    isActive('/app/dashboard')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Link>
                <Link
                  to="/app/sites"
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                    isActive('/app/sites')
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  CMS Sites
                </Link>
                {userRole === 'admin' && (
                  <Link
                    to="/app/admin"
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                      isActive('/app/admin')
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="hidden sm:block text-sm text-gray-600">{user?.email}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-8 h-8 bg-gray-300 rounded-full p-0">
                    <User className="w-4 h-4 text-gray-700" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2 border-b">
                    <p className="text-sm font-medium">{user?.email}</p>
                    {userRole && (
                      <div className="flex items-center gap-1 mt-1">
                        {userRole === 'admin' && <Shield className="w-3 h-3 text-purple-600" />}
                        {userRole === 'client_editor' && <User className="w-3 h-3 text-blue-600" />}
                        {userRole === 'client_viewer' && <User className="w-3 h-3 text-gray-600" />}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          userRole === 'admin' ? 'bg-purple-100 text-purple-700' :
                          userRole === 'client_editor' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {userRole === 'admin' ? 'Admin' :
                           userRole === 'client_editor' ? 'Editor' :
                           userRole === 'client_viewer' ? 'Viewer' :
                           userRole}
                        </span>
                      </div>
                    )}
                  </div>
                  <DropdownMenuItem
                    onClick={signOut}
                    className="flex items-center cursor-pointer"
                    data-testid="button-sign-out"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-16 min-h-screen bg-gray-50">
        {children}
      </div>
    </div>
  );
}
