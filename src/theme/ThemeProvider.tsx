import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const darkColors = {
  bg: "#101312",
  panel: "#191d1b",
  raised: "#222824",
  border: "#2b322e",
  text: "#f3f6f4",
  muted: "#8c9b92",
  green: "#29dc8b",
  red: "#f27979",
  blue: "#77b8ef",
  hero: "#193125",
  heroBorder: "#2a4935",
  heroText: "#abc4b4",
  active: "#203d2d",
  iconBg: "#203b2b",
  inputText: "#bac5be",
  placeholder: "#65746b",
  sidebar: "#141816",
  nav: "#171d19",
  avatar: "#233b2b",
  avatarBorder: "#35513d",
  badge: "#203029",
  toast: "#293d30",
  toastBorder: "#40624c",
  sheet: "#191f1b",
  danger: "#422626",
};
export type ThemeColors = typeof darkColors;
export const lightColors: ThemeColors = {
  bg: "#f4f7f5",
  panel: "#ffffff",
  raised: "#edf2ee",
  border: "#dce5df",
  text: "#17271d",
  muted: "#64766a",
  green: "#087c47",
  red: "#bf4545",
  blue: "#2879b8",
  hero: "#e0f3e6",
  heroBorder: "#c1dfcc",
  heroText: "#3d6b4c",
  active: "#e0f3e6",
  iconBg: "#e1f3e7",
  inputText: "#405747",
  placeholder: "#809187",
  sidebar: "#ffffff",
  nav: "#ffffff",
  avatar: "#e0f3e6",
  avatarBorder: "#c1dfcc",
  badge: "#e7f4eb",
  toast: "#e1f3e7",
  toastBorder: "#a6d8b6",
  sheet: "#ffffff",
  danger: "#fbe7e7",
};
export type ThemeMode = "light" | "dark";
const KEY = "@meus-gastos/theme";
const Context = createContext({
  mode: "dark" as ThemeMode,
  colors: darkColors,
  setMode: async (_mode: ThemeMode) => {},
  ready: false,
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark"),
    [ready, setReady] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "light" || v === "dark") setModeState(v);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  const setMode = async (next: ThemeMode) => {
    await AsyncStorage.setItem(KEY, next);
    setModeState(next);
  };
  const value = useMemo(
    () => ({
      mode,
      colors: mode === "dark" ? darkColors : lightColors,
      setMode,
      ready,
    }),
    [mode, ready],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useTheme = () => useContext(Context);
