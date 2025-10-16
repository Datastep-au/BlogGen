import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'wouter';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    // Check user role from backend
    if (user) {
      fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${user.id}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          setUserRole(data.role || 'client_editor');
          setCheckingRole(false);
        })
        .catch(() => {
          // Default to client_editor if can't fetch role
          setUserRole('client_editor');
          setCheckingRole(false);
        });
    } else {
      setCheckingRole(false);
    }
  }, [user]);

  if (loading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Check admin requirement
  if (requireAdmin && userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-600">Admin access is required to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
