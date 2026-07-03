import React, { createContext, useContext, useState, useEffect } from 'react';
import { ClerkProvider, useUser, useAuth, useClerk } from '@clerk/clerk-react';

const AuthContext = createContext(null);

const MOCK_USER = {
  id: 'demo_user_123',
  name: 'Demo Architect',
  email: 'demo@example.com',
  imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80',
};

// Clerk Wrapper to bridge Clerk state into AuthContext
const ClerkAuthBridge = ({ children }) => {
  const { user, isLoaded: userLoaded, isSignedIn } = useUser();
  const { getToken, signOut } = useAuth();
  const [token, setToken] = useState(null);

  useEffect(() => {
    const fetchToken = async () => {
      if (isSignedIn) {
        try {
          const t = await getToken();
          setToken(t);
        } catch (e) {
          console.error('Failed to get token:', e);
        }
      } else {
        setToken(null);
      }
    };
    fetchToken();
  }, [isSignedIn, getToken]);

  const value = {
    isLoaded: userLoaded,
    isSignedIn: !!isSignedIn,
    isDemoMode: false,
    user: user ? {
      id: user.id,
      name: user.fullName || user.username || 'User',
      email: user.primaryEmailAddress?.emailAddress || '',
      imageUrl: user.imageUrl || '',
    } : null,
    getToken: () => getToken(),
    signOut: () => signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Mock Auth Wrapper for when Clerk is not configured
const MockAuthWrapper = ({ children }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Sync state with localstorage so reload keeps them signed in in demo mode
  useEffect(() => {
    const loggedIn = localStorage.getItem('demo_logged_in') === 'true';
    setIsSignedIn(loggedIn);
  }, []);

  const signIn = () => {
    localStorage.setItem('demo_logged_in', 'true');
    setIsSignedIn(true);
  };

  const signOut = () => {
    localStorage.removeItem('demo_logged_in');
    setIsSignedIn(false);
  };

  const value = {
    isLoaded: true,
    isSignedIn,
    isDemoMode: true,
    user: isSignedIn ? MOCK_USER : null,
    getToken: async () => 'demo-token',
    signOut,
    signIn,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const CustomAuthProvider = ({ children }) => {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (publishableKey && publishableKey !== 'pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX') {
    return (
      <ClerkProvider publishableKey={publishableKey}>
        <ClerkAuthBridge>{children}</ClerkAuthBridge>
      </ClerkProvider>
    );
  }

  // Fallback to Mock authentication in demo mode
  return <MockAuthWrapper>{children}</MockAuthWrapper>;
};

export const useAppAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAppAuth must be used within a CustomAuthProvider');
  }
  return context;
};
