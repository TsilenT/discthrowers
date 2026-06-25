import { useState, useCallback } from "react";
import { getTheme, DEFAULT_THEME } from "./index";
import type { ThemeContent } from "./types";

const STORAGE_KEY = "discthrowers-theme";

function readStoredTheme(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function useTheme(): {
  theme: ThemeContent;
  themeId: string;
  setThemeId: (id: string) => void;
} {
  const [themeId, setThemeIdState] = useState<string>(readStoredTheme);

  const setThemeId = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
    setThemeIdState(id);
  }, []);

  return { theme: getTheme(themeId), themeId, setThemeId };
}
