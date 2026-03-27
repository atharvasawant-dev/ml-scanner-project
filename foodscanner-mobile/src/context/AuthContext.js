import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getToken, removeToken, saveToken } from '../utils/storage';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  useEffect(() => {
    getToken().then((token) => setIsLoggedIn(!!token));
  }, []);

  const login = async (token) => {
    await saveToken(token);
    setIsLoggedIn(true);
  };

  const logout = async () => {
    try {
      await removeToken();
      await AsyncStorage.clear();
    } catch (e) {
      // ignore
    }
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
