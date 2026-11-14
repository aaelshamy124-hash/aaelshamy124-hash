import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

export type CloudSyncStatus = "idle" | "syncing" | "synced" | "error";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  idToken: string | null;
  authError: string | null;
  syncStatus: CloudSyncStatus;
  syncMessage: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  setSyncState: (status: CloudSyncStatus, message?: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const token = await nextUser.getIdToken();
          setIdToken(token);
        } catch (err) {
          console.warn("Could not retrieve ID token:", err);
          setIdToken(null);
        }
      } else {
        setIdToken(null);
        setSyncStatus("idle");
        setSyncMessage(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        const token = await cred.user.getIdToken();
        setIdToken(token);
      }
    } catch (err: any) {
      const msg = err?.message || "Google sign-in was cancelled or failed.";
      setAuthError(msg);
      console.error("Google sign-in failed:", err);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
      setIdToken(null);
      setSyncStatus("idle");
      setSyncMessage(null);
    } catch (err: any) {
      setAuthError(err?.message || "Failed to sign out.");
    }
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!auth.currentUser) return {};
    try {
      const freshToken = await auth.currentUser.getIdToken();
      setIdToken(freshToken);
      return { Authorization: `Bearer ${freshToken}` };
    } catch {
      return idToken ? { Authorization: `Bearer ${idToken}` } : {};
    }
  }, [idToken]);

  const setSyncState = useCallback((status: CloudSyncStatus, message: string | null = null) => {
    setSyncStatus(status);
    setSyncMessage(message);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        idToken,
        authError,
        syncStatus,
        syncMessage,
        signInWithGoogle,
        signOutUser,
        getAuthHeaders,
        setSyncState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
