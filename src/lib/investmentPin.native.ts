import { pbkdf2 } from "react-native-quick-crypto";
import {
  createInvestmentAccess as createAccess,
  verifyInvestmentPin as verifyPin,
  type PinDeriver,
} from "./investmentPin.ts";
import { type InvestmentAccess } from "./investments.ts";
export {
  validPin,
  failedPinAttempt,
  pinBlocked,
  parsePinAttempts,
  type PinAttempts,
} from "./investmentPin.ts";

// Runs the same PBKDF2 parameters on a native worker instead of Hermes.
const deriveNative: PinDeriver = (pin, salt) =>
  new Promise((resolve, reject) => {
    pbkdf2(pin, salt, 100000, 32, "sha256", (error, key) => {
      if (error) reject(error);
      else if (!key)
        reject(new Error("Não foi possível validar a proteção do PIN."));
      else resolve(Uint8Array.from(key));
    });
  });
export function createInvestmentAccess(pin: string, salt: Uint8Array) {
  return createAccess(pin, salt, deriveNative);
}
export function verifyInvestmentPin(pin: string, access: InvestmentAccess) {
  return verifyPin(pin, access, deriveNative);
}
