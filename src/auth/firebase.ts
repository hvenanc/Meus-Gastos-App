import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  initializeAuth,
  getAuth,
  type Auth,
} from "firebase/auth";
import { firebaseConfig, isFirebaseConfigured } from "./firebaseConfig";
export { isFirebaseConfigured };
export const auth: Auth | null = isFirebaseConfigured
  ? (() => {
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      try {
        return initializeAuth(app, { persistence: browserLocalPersistence });
      } catch (error) {
        if ((error as { code?: string }).code === "auth/already-initialized")
          return getAuth(app);
        throw error;
      }
    })()
  : null;
if (auth) auth.languageCode = "pt-BR";
