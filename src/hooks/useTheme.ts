import { useCallback, useEffect, useState } from 'react';
import { applyTheme, readStoredTheme } from '../lib/theme';
import type { ThemeName } from '../lib/theme';

export interface ThemeControl {
  readonly theme: ThemeName;
  readonly toggleTheme: () => void;
}

/**
 * Thème courant et bascule jour/nuit.
 *
 * `main.tsx` a déjà posé le thème mémorisé avant le premier rendu : l'état
 * initial est donc la même valeur, et l'effet ne fait que la réappliquer.
 */
export function useTheme(): ThemeControl {
  const [theme, setTheme] = useState<ThemeName>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
