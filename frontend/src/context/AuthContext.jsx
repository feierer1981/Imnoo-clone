import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// Authentifizierungs-Provider mit Mock-Daten
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('cnc_user');
    return saved ? JSON.parse(saved) : null;
  });

  const isAuthenticated = !!user;

  // Mock-Login: Setzt einen Beispielbenutzer
  const login = async (email, password) => {
    const mockUser = {
      name: 'Max Mustermann',
      email,
      rolle: 'admin',
    };
    setUser(mockUser);
    localStorage.setItem('cnc_user', JSON.stringify(mockUser));
    return mockUser;
  };

  // Logout: Benutzer abmelden
  const logout = () => {
    setUser(null);
    localStorage.removeItem('cnc_user');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  return ctx;
}

export default AuthContext;
