import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";
const Context = createContext<{
  user: User | null;
  loading: boolean;
  registering: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  reset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  registering: false,
  configured: isFirebaseConfigured,
  login: async () => {},
  register: async () => {},
  reset: async () => {},
  logout: async () => {},
});
function requireAuth() {
  if (!auth) throw new Error("Serviço de acesso indisponível.");
  return auth;
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(Boolean(auth)),
    [registering, setRegistering] = useState(false);
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);
  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
  };
  const register = async (name: string, email: string, password: string) => {
    setRegistering(true);
    try {
      const result = await createUserWithEmailAndPassword(
        requireAuth(),
        email.trim(),
        password,
      );
      await updateProfile(result.user, { displayName: name.trim() });
      setUser(result.user);
    } finally {
      setRegistering(false);
    }
  };
  const reset = async (email: string) => {
    await sendPasswordResetEmail(requireAuth(), email.trim());
  };
  const logout = async () => {
    await signOut(requireAuth());
  };
  return (
    <Context.Provider
      value={{
        user,
        loading,
        registering,
        configured: isFirebaseConfigured,
        login,
        register,
        reset,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
