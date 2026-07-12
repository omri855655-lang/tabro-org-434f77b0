const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readRaw = (key: string): string | null => {
  if (!canUseStorage()) return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeRaw = (key: string, value: string) => {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota and privacy mode errors.
  }
};

const remove = (key: string) => {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage access errors.
  }
};

export const safeLocalStorage = {
  getString(key: string, fallback = "") {
    const value = readRaw(key);
    return value ?? fallback;
  },

  setString(key: string, value: string) {
    writeRaw(key, value);
  },

  getJSON<T>(key: string, fallback: T): T {
    const value = readRaw(key);
    if (!value) return fallback;

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  },

  setJSON(key: string, value: unknown) {
    try {
      writeRaw(key, JSON.stringify(value));
    } catch {
      // Ignore serialization or storage errors.
    }
  },

  remove,
};
