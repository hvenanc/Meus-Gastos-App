export const STORAGE_KEY = "@meus-gastos/data/v1";
export const storageKey = (userId?: string) =>
  userId ? `${STORAGE_KEY}/${userId}` : STORAGE_KEY;
