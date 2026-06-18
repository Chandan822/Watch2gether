import { createContext, useState, useContext, useEffect } from 'react';

/**
 * User Context Provider
 * 
 * Manages the client's current username, storing it in state and persisting it
 * inside the browser's localStorage for quick reconnections.
 */
const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [username, setUsernameState] = useState(() => {
    return localStorage.getItem('w2g_username') || '';
  });

  const setUsername = (name) => {
    setUsernameState(name);
  };

  useEffect(() => {
    if (username) {
      localStorage.setItem('w2g_username', username);
    } else {
      localStorage.removeItem('w2g_username');
    }
  }, [username]);

  return (
    <UserContext.Provider value={{ username, setUsername }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
