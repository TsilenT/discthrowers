import { discGolfTheme } from "./discgolf";
import type { ThemeContent } from "./types";

export type { ThemeContent, CardDisplay, TreeDisplay } from "./types";

export const DEFAULT_THEME = "discgolf";

export const THEMES: Record<string, ThemeContent> = {
  discgolf: discGolfTheme,
};

export function getTheme(id: string): ThemeContent {
  return THEMES[id] ?? THEMES[DEFAULT_THEME]!;
}
