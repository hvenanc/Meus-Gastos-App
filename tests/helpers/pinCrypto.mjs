import { randomBytes } from "node:crypto";
export const getRandomBytesAsync = async (size) =>
  Uint8Array.from(randomBytes(size));
