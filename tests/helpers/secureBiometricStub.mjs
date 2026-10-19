export const state = {
  hardware: true,
  enrolled: true,
  supported: true,
  allow: true,
  data: new Map(),
  calls: [],
};
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 7;
export function canUseBiometricAuthentication() {
  return state.supported;
}
export async function hasHardwareAsync() {
  return state.hardware;
}
export async function isEnrolledAsync() {
  return state.enrolled;
}
export async function setItemAsync(key, value, options) {
  state.calls.push({ method: "set", key, options });
  if (!options.requireAuthentication) throw Error("Unprotected");
  state.data.set(key, value);
}
export async function getItemAsync(key, options) {
  state.calls.push({ method: "get", key, options });
  if (!options.requireAuthentication) throw Error("Unprotected");
  if (!state.allow) throw Error("Cancelled");
  return state.data.get(key) ?? null;
}
export async function deleteItemAsync(key) {
  state.data.delete(key);
}
