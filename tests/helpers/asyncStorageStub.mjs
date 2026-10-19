export const persisted = new Map();
export default {
  async getAllKeys() {
    return [...persisted.keys()];
  },
  async multiGet(keys) {
    return keys.map((key) => [key, persisted.get(key) ?? null]);
  },
  async multiSet(entries) {
    for (const [key, value] of entries) persisted.set(key, value);
  },
  async multiRemove(keys) {
    for (const key of keys) persisted.delete(key);
  },
  async getItem(key) {
    return persisted.get(key) ?? null;
  },
  async removeItem(key) {
    persisted.delete(key);
  },
  async setItem(key, value) {
    persisted.set(key, value);
  },
};
