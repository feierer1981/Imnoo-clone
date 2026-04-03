import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rolle aus Firestore laden
  const loadUserRole = async (firebaseUser) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        return userDoc.data().rolle || 'none';
      }
      return 'none';
    } catch (err) {
      console.error('Fehler beim Laden der Rolle:', err);
      return 'none';
    }
  };

  // Firebase Auth State beobachten
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const rolle = await loadUserRole(firebaseUser);
        setUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email,
          email: firebaseUser.email,
          rolle,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Anmeldung mit E-Mail und Passwort
  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const rolle = await loadUserRole(result.user);
    setUser({
      uid: result.user.uid,
      name: result.user.displayName || result.user.email,
      email: result.user.email,
      rolle,
    });
    return result.user;
  };

  // Registrierung - neuer Nutzer bekommt rolle "none"
  const register = async (name, email, password) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });

    // User-Dokument ZUERST anlegen, bevor onAuthStateChanged die Rolle liest
    await setDoc(doc(db, 'users', result.user.uid), {
      name,
      email,
      rolle: 'none',
      erstelltAm: new Date().toISOString(),
    });

    // User-State direkt setzen (onAuthStateChanged wird es nochmal laden)
    setUser({
      uid: result.user.uid,
      name,
      email: result.user.email,
      rolle: 'none',
    });
    return result.user;
  };

  // Abmeldung
  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isAuthorized = isAuthenticated && user?.rolle === 'user';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated, isAuthorized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  return context;
}
