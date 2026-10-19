export const state = {
  available: true,
  enabled: false,
  success: true,
  deferred: null,
  enrolls: 0,
};
export async function biometricAvailable() {
  return state.available;
}
export async function biometricEnabled() {
  return state.enabled && state.available;
}
export async function enableBiometrics() {
  state.enabled = true;
  state.enrolls++;
}
export async function disableBiometrics() {
  state.enabled = false;
}
export async function authenticateBiometrics() {
  if (!state.success) throw new Error("Cancelled");
  return state.deferred ? state.deferred : state.enabled && state.success;
}
