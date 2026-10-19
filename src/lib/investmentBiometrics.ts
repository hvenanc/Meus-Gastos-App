export async function biometricAvailable() {
  return false;
}
export async function biometricEnabled(_user: string, _hash: string) {
  return false;
}
export async function enableBiometrics(
  _user: string,
  _hash: string,
): Promise<void> {
  throw new Error("Biometria disponível somente no aplicativo instalado.");
}
export async function disableBiometrics(
  _user: string,
  _hash: string,
): Promise<void> {}
export async function authenticateBiometrics(
  _user: string,
  _hash: string,
): Promise<boolean> {
  return false;
}
