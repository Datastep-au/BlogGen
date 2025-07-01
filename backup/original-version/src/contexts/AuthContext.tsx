import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('Attempting email sign-in for:', email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error('Email sign-in error:', error);
    } else {
      console.log('Email sign-in successful');
    }
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    console.log('Attempting email sign-up for:', email);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}`,
      },
    });
    if (error) {
      console.error('Email sign-up error:', error);
    } else {
      console.log('Email sign-up successful');
    }
    return { error };
  };

  const signInWithGoogle = async () => {
    console.log('Attempting Google OAuth sign-in...');
    console.log('Current URL:', window.location.origin);
    console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      
      if (error) {
        console.error('Google OAuth error:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
        });
        
        // Provide more specific error messages
        let userFriendlyMessage = error.message;
        
        if (error.message.includes('OAuth provider not enabled')) {
          userFriendlyMessage = 'Google sign-in is not enabled. Please contact support.';
        } else if (error.message.includes('Invalid client configuration')) {
          userFriendlyMessage = 'Google OAuth is not properly configured. Please contact support.';
        } else if (error.message.includes('refused to connect')) {
          userFriendlyMessage = 'Unable to connect to Google. Please check your internet connection and try again.';
        }
        
        return { error: { ...error, message: userFriendlyMessage } };
      } else {
        console.log('Google OAuth initiated successfully');
        return { error: null };
      }
    } catch (err) {
      console.error('Google OAuth exception:', err);
      return { 
        error: { 
          message: 'Failed to initiate Google sign-in. Please try again or use email sign-in.' 
        } 
      };
    }
  };

  const signOut = async () => {
    console.log('Signing out...');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign-out error:', error);
    } else {
      console.log('Sign-out successful');
    }
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}