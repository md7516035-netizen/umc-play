import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { DEFAULT_SITE_CONFIG, DEFAULT_SITE_RULES } from '../constants/validation';
import type { PlayerProfile, SiteConfig, SiteRules } from '../types/umc';

const BOOTSTRAP_ADMIN_EMAIL = 'md7516035@gmail.com';

interface AuthContextValue {
  user: User | null;
  playerProfile: PlayerProfile | null;
  isAdmin: boolean;
  authReady: boolean;
  siteConfig: SiteConfig;
  siteRules: SiteRules;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [siteRules, setSiteRules] = useState<SiteRules>(DEFAULT_SITE_RULES);

  // Subscribe to global site config and rules
  useEffect(() => {
    const configRef = doc(db, 'siteConfig', 'global');
    const unsubConfig = onSnapshot(
      configRef,
      (snap) => {
        if (snap.exists()) {
          setSiteConfig(snap.data() as SiteConfig);
        } else {
          setSiteConfig(DEFAULT_SITE_CONFIG);
        }
      },
      (err) => {
        console.warn('Site config read fallback:', err);
      }
    );

    const rulesRef = doc(db, 'siteRules', 'current');
    const unsubRules = onSnapshot(
      rulesRef,
      (snap) => {
        if (snap.exists()) {
          setSiteRules(snap.data() as SiteRules);
        } else {
          setSiteRules(DEFAULT_SITE_RULES);
        }
      },
      (err) => {
        console.warn('Site rules read fallback:', err);
      }
    );

    return () => {
      unsubConfig();
      unsubRules();
    };
  }, []);

  // Listen to Firebase Auth state & resolve role + player doc
  useEffect(() => {
    let unsubPlayer: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubPlayer) {
        unsubPlayer();
        unsubPlayer = null;
      }

      setUser(firebaseUser);

      if (!firebaseUser) {
        setPlayerProfile(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      try {
        let adminFlag = false;
        const isBootstrapAdmin =
          firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL &&
          firebaseUser.emailVerified === true;

        const adminDocRef = doc(db, 'admins', firebaseUser.uid);
        const adminSnap = await getDoc(adminDocRef);

        if (adminSnap.exists()) {
          adminFlag = true;
        } else if (isBootstrapAdmin) {
          adminFlag = true;
          try {
            await setDoc(adminDocRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || 'UMC Head Administrator',
              addedBy: firebaseUser.uid,
              createdAt: serverTimestamp(),
            });
          } catch {
            // Non-blocking if already bootstrapped
          }
        }

        setIsAdmin(adminFlag);

        const playerRef = doc(db, 'players', firebaseUser.uid);
        unsubPlayer = onSnapshot(
          playerRef,
          (snap) => {
            if (snap.exists()) {
              setPlayerProfile(snap.data() as PlayerProfile);
            } else {
              setPlayerProfile(null);
            }
            setAuthReady(true);
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.GET, `players/${firebaseUser.uid}`);
            } catch {
              setPlayerProfile(null);
              setAuthReady(true);
            }
          }
        );
      } catch {
        setIsAdmin(false);
        setPlayerProfile(null);
        setAuthReady(true);
      }
    });

    return () => {
      unsubAuth();
      if (unsubPlayer) unsubPlayer();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
    setPlayerProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        playerProfile,
        isAdmin,
        authReady,
        siteConfig,
        siteRules,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
