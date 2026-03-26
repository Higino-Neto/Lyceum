import { useState, useEffect, useCallback } from "react";

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, SetValue<T>, () => void] {
  const prefixedKey = `lyceum_${key}`;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(prefixedKey);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue: SetValue<T> = useCallback(
    (value) => {
      setStoredValue((prev) => {
        const valueToStore =
          value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(
            prefixedKey,
            JSON.stringify(valueToStore)
          );
        } catch (error) {
          console.warn(`Error saving to localStorage (${key}):`, error);
        }
        return valueToStore;
      });
    },
    [prefixedKey]
  );

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(prefixedKey);
    } catch (error) {
      console.warn(`Error removing from localStorage (${key}):`, error);
    }
  }, [prefixedKey]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === prefixedKey && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch {
          // ignore parse errors
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [prefixedKey]);

  return [storedValue, setValue, remove];
}