export const persisted = new Map();
export default {
  async multiRemove(keys) { for (const key of keys) persisted.delete(key); },
  async getItem(key) { return persisted.get(key) ?? null; },
  async setItem(key, value) { persisted.set(key, value); },
};
