import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  type Persistence,
  type Auth,
} from "firebase/auth";
import * as FirebaseAuth from "firebase/auth";
// The RN runtime exports this function; Firebase’s default declarations cover web only.
const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence(storage: typeof AsyncStorage): Persistence;
};
import { firebaseConfig, isFirebaseConfigured } from "./firebaseConfig";
export { isFirebaseConfigured };
export const auth: Auth | null = isFirebaseConfigured
  ? (() => {
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      try {
        return initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } catch (error) {
        if ((error as { code?: string }).code === "auth/already-initialized")
          return getAuth(app);
        throw error;
      }
    })()
  : null;
if (auth) auth.languageCode = "pt-BR";
