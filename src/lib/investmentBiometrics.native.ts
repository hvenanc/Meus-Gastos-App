import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
const safe = (user: string) =>
  Array.from(user)
    .map((c) => c.charCodeAt(0).toString(16))
    .join("");
const key = (user: string, hash: string) =>
  `investment.bio.${safe(user)}.${hash}`;
const marker = (user: string) => `@meus-gastos/biometrics/${user}`;
const options = {
  requireAuthentication: true,
  authenticationPrompt: "Desbloquear investimentos",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
export async function biometricAvailable() {
  return (
    (await LocalAuthentication.hasHardwareAsync()) &&
    (await LocalAuthentication.isEnrolledAsync()) &&
    SecureStore.canUseBiometricAuthentication()
  );
}
export async function biometricEnabled(user: string, hash: string) {
  return (
    (await AsyncStorage.getItem(marker(user))) === hash &&
    (await biometricAvailable())
  );
}
export async function enableBiometrics(user: string, hash: string) {
  if (!(await biometricAvailable()))
    throw new Error(
      "Cadastre uma biometria segura nas configurações deste aparelho.",
    );
  const previous = await AsyncStorage.getItem(marker(user));
  if (previous && previous !== hash)
    await SecureStore.deleteItemAsync(key(user, previous));
  await SecureStore.setItemAsync(key(user, hash), hash, options);
  await AsyncStorage.setItem(marker(user), hash);
}
export async function disableBiometrics(user: string, hash: string) {
  await SecureStore.deleteItemAsync(key(user, hash));
  await AsyncStorage.removeItem(marker(user));
}
export async function authenticateBiometrics(user: string, hash: string) {
  if (!(await biometricEnabled(user, hash))) return false;
  const value = await SecureStore.getItemAsync(key(user, hash), options);
  if (value === null) await disableBiometrics(user, hash);
  return value === hash;
}
