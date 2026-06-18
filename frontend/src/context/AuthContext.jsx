import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { socket } from '../services/socket.js';

/**
 * Authentication Context Provider
 * 
 * Manages access tokens in memory and handles HttpOnly refresh tokens in cookies.
 * Contains login, register, logout, and automatic session restoration.
 */
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

  // 1. Silent Refresh Session (restore state on reload)
  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setAccessToken(data.data.accessToken);
        
        // Decode user payload properties from the JWT access token (optional parsing)
        // Or simply retrieve user details. Since refresh only returns accessToken,
        // we can extract claims from the JWT base64 payload.
        const payload = JSON.parse(atob(data.data.accessToken.split('.')[1]));
        setUser({
          id: payload.id,
          username: payload.username,
          email: payload.email,
          avatarUrl: payload.avatarUrl,
        });
        return data.data.accessToken;
      }
    } catch (err) {
      console.warn('Silent session refresh failed (user probably not logged in).');
    } finally {
      setLoading(false);
    }
    return null;
  }, [API_URL]);

  // Attempt to restore user session when the application mounts
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Connect and register global WebSockets session on login
  useEffect(() => {
    if (user && accessToken) {
      socket.auth = { token: accessToken };
      
      const handleConnect = () => {
        socket.emit('register-user');
        console.log('🔌 Registered user status globally for:', user.username);
      };

      socket.on('connect', handleConnect);
      socket.connect();

      if (socket.connected) {
        handleConnect();
      }

      return () => {
        socket.off('connect', handleConnect);
        socket.disconnect();
      };
    } else {
      socket.disconnect();
    }
  }, [user, accessToken]);

  // 2. Register Profile
  const register = async (username, email, password) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  };

  // 3. Log In Session
  const login = async (username, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  };

  // 4. Log Out Session
  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      // Always wipe local memory state
      setAccessToken(null);
      setUser(null);
    }
  };

  /**
   * Fetch Wrapper with Automated Token Interceptor
   * 
   * Custom fetch that injects the current access token. If the response
   * returns 401 (Unauthorized/Expired), it attempts to refresh the access token
   * and retry the query. If the refresh fails, it clears local credentials.
   */
  const fetchWithAuth = async (url, options = {}) => {
    let currentToken = accessToken;

    // Attach token to authorization headers.
    // Skip setting Content-Type: application/json if sending FormData (image uploads)
    const headers = {
      ...options.headers,
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      ...(currentToken && { Authorization: `Bearer ${currentToken}` }),
    };

    let response = await fetch(url, { ...options, headers });

    // Handle expired tokens
    if (response.status === 401) {
      console.log('🔄 Access token expired. Attempting token rotation...');
      const renewedToken = await refreshSession();

      if (renewedToken) {
        // Retry the original query with the new token
        headers.Authorization = `Bearer ${renewedToken}`;
        response = await fetch(url, { ...options, headers });
      } else {
        // Force logout if refresh token expired
        setAccessToken(null);
        setUser(null);
      }
    }

    return response;
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        register,
        logout,
        fetchWithAuth,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};

export default AuthContext;
