export const View = "view",
  Text = "text",
  TextInput = "input";
const listeners = new Set();
export const AppState = {
  addEventListener(_event, callback) {
    listeners.add(callback);
    return {
      remove() {
        listeners.delete(callback);
      },
    };
  },
  emit(state) {
    for (const callback of listeners) callback(state);
  },
};
