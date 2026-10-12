import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { type InvestmentAccess, validInvestmentAccess } from "./investments.ts";
export const validPin = (pin: string) => /^\d{4}$/.test(pin);
export type PinDeriver = (pin: string, salt: Uint8Array) => Promise<Uint8Array>;
const deriveInJavaScript: PinDeriver = (pin, salt) =>
  pbkdf2Async(
    sha256,
    Uint8Array.from(pin, (c) => c.charCodeAt(0)),
    salt,
    {
      c: 100000,
      dkLen: 32,
    },
  );
export async function createInvestmentAccess(
  pin: string,
  salt: Uint8Array,
  derive: PinDeriver = deriveInJavaScript,
): Promise<InvestmentAccess> {
  if (!validPin(pin)) throw new Error("O PIN deve ter exatamente 4 dígitos.");
  if (salt.length !== 16)
    throw new Error("Não foi possível gerar a proteção do PIN.");
  const hash = await derive(pin, salt);
  if (hash.length !== 32)
    throw new Error("Não foi possível validar a proteção do PIN.");
  return {
    version: 1,
    salt: bytesToHex(salt),
    hash: bytesToHex(hash),
    iterations: 100000,
  };
}
export async function verifyInvestmentPin(
  pin: string,
  access: InvestmentAccess,
  derive: PinDeriver = deriveInJavaScript,
) {
  if (!validPin(pin) || !validInvestmentAccess(access)) return false;
  const calculated = await createInvestmentAccess(
    pin,
    hexToBytes(access.salt),
    derive,
  );
  let difference = 0;
  for (let i = 0; i < access.hash.length; i++)
    difference |= access.hash.charCodeAt(i) ^ calculated.hash.charCodeAt(i);
  return difference === 0;
}
export type PinAttempts = { failures: number; blockedUntil: number };
export function failedPinAttempt(
  previous: PinAttempts,
  now: number,
): PinAttempts {
  const failures = previous.failures + 1;
  const minutes =
    failures >= 5 ? Math.min(15, 2 ** Math.floor((failures - 5) / 5)) : 0;
  return { failures, blockedUntil: minutes ? now + minutes * 60000 : 0 };
}
export const pinBlocked = (attempts: PinAttempts, now: number) =>
  attempts.blockedUntil > now;

export function parsePinAttempts(raw: string | null): PinAttempts {
  const value = raw ? JSON.parse(raw) : { failures: 0, blockedUntil: 0 };
  if (
    !Number.isSafeInteger(value.failures) ||
    value.failures < 0 ||
    !Number.isFinite(value.blockedUntil) ||
    value.blockedUntil < 0
  )
    throw new Error("Não foi possível ler o bloqueio de PIN.");
  return value;
}
