import type { ThemeName } from '../lib/theme';

export interface ThemeToggleProps {
  readonly theme: ThemeName;
  readonly onToggle: () => void;
}

/**
 * Bouton jour/nuit. Le glyphe annonce la **destination**, pas l'état courant :
 * un soleil tant qu'on est en sombre, une lune en clair. Les icônes sont tracées
 * ici — aucune bibliothèque n'est installée, et la spec en interdit de nouvelles.
 */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const next = theme === 'dark' ? 'clair' : 'sombre';
  const label = `Passer au thème ${next}`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-anthracite-700 text-zinc-400 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none sm:h-6 sm:w-6"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-5 w-5 sm:h-3.5 sm:w-3.5"
      >
        {theme === 'dark' ? (
          <>
            <circle cx="8" cy="8" r="3.1" />
            <path d="M8 1.4v1.3M8 13.3v1.3M1.4 8h1.3M13.3 8h1.3" />
            <path d="M3.4 3.4l.9.9M11.7 11.7l.9.9M12.6 3.4l-.9.9M4.3 11.7l-.9.9" />
          </>
        ) : (
          <path d="M13.3 9.9A5.5 5.5 0 0 1 6.1 2.7a5.5 5.5 0 1 0 7.2 7.2Z" />
        )}
      </svg>
    </button>
  );
}
