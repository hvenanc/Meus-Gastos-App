import { pbkdf2 as nativePbkdf2 } from "node:crypto";
export const calls = [];
let fault;
export function setFault(value) {
  fault = value;
}
export function pbkdf2(pin, salt, iterations, length, digest, callback) {
  calls.push({ iterations, length, digest });
  if (fault === "error") return callback(new Error("Native test failure"));
  if (fault === "empty") return callback(null, undefined);
  nativePbkdf2(pin, salt, iterations, length, digest, callback);
}
