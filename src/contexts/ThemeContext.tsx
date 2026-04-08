import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type ThemeMode = 'light' | 'dark' | 'custom';

export interface ThemeState {
  themeMode: ThemeMode;
  primary: string;
  secondary: string;
  accent: string;
  useGradient: boolean;
  appBg: string;
  surfaceBg: string;
  /** null = auto (derive du fond), sinon hex force par l'utilisateur. */
  textColor: string | null;
  /** null = auto (derive de surfaceBg), sinon hex force par l'utilisateur. */
  highlightBg: string | null;
}

/** Mixe deux hex selon un ratio (0..1). */
function mixHex(a: string, b: string, t: number): string {
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  const ar = parseInt(pa.slice(0, 2), 16), ag = parseInt(pa.slice(2, 4), 16), ab = parseInt(pa.slice(4, 6), 16);
  const br = parseInt(pb.slice(0, 2), 16), bg = parseInt(pb.slice(2, 4), 16), bb = parseInt(pb.slice(4, 6), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return '#' + [r, g, b2].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Calcule un fond de mise en avant lisible : surfaceBg legerement teinte vers son oppose. */
export function resolveHighlightBg(state: Pick<ThemeState, 'highlightBg' | 'surfaceBg'>): string {
  if (state.highlightBg) return state.highlightBg;
  return isLightColor(state.surfaceBg)
    ? mixHex(state.surfaceBg, '#000000', 0.06)  // surface claire → assombri 6%
    : mixHex(state.surfaceBg, '#ffffff', 0.10); // surface sombre  → eclairci 10%
}

/** Luminance perceptuelle [0..1]. Sert a choisir un texte lisible. */
export function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

const TEXT_LIGHT = '#f8fafc';
const TEXT_DARK  = '#0f172a';

export function resolveTextColor(state: Pick<ThemeState, 'textColor' | 'surfaceBg'>): string {
  if (state.textColor) return state.textColor;
  return isLightColor(state.surfaceBg) ? TEXT_DARK : TEXT_LIGHT;
}

export const CUSTOM_DEFAULTS = {
  appBg: '#f1f5f9',      // slate-100
  surfaceBg: '#ffffff',
  textColor: null as string | null,   // auto par defaut
  highlightBg: null as string | null, // auto par defaut
};

export type ThemePreset = Omit<ThemeState, 'themeMode'>;

export const THEME_PRESETS: { id: string; name: string; preset: ThemePreset }[] = [
  {
    id: 'light',
    name: 'Clair',
    preset: {
      primary: '#3b82f6', secondary: '#9333ea', accent: '#06b6d4', useGradient: true,
      appBg: '#f1f5f9', surfaceBg: '#ffffff', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'dark',
    name: 'Sombre',
    preset: {
      primary: '#60a5fa', secondary: '#a855f7', accent: '#22d3ee', useGradient: true,
      appBg: '#0f172a', surfaceBg: '#1e293b', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'oled',
    name: 'OLED',
    preset: {
      primary: '#7c3aed', secondary: '#ec4899', accent: '#06b6d4', useGradient: true,
      appBg: '#000000', surfaceBg: '#0a0a0a', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'cosy',
    name: 'Cosy',
    preset: {
      primary: '#a16207', secondary: '#b45309', accent: '#dc2626', useGradient: true,
      appBg: '#fef3c7', surfaceBg: '#fffbeb', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'mocha',
    name: 'Mocha',
    preset: {
      primary: '#92400e', secondary: '#78350f', accent: '#d97706', useGradient: true,
      appBg: '#1c1410', surfaceBg: '#2b1d14', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'forest',
    name: 'Forêt',
    preset: {
      primary: '#15803d', secondary: '#166534', accent: '#84cc16', useGradient: true,
      appBg: '#f0fdf4', surfaceBg: '#ffffff', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'ocean',
    name: 'Océan',
    preset: {
      primary: '#0284c7', secondary: '#0369a1', accent: '#06b6d4', useGradient: true,
      appBg: '#ecfeff', surfaceBg: '#ffffff', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    preset: {
      primary: '#f97316', secondary: '#e11d48', accent: '#facc15', useGradient: true,
      appBg: '#fff7ed', surfaceBg: '#ffffff', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    preset: {
      primary: '#bd93f9', secondary: '#ff79c6', accent: '#50fa7b', useGradient: true,
      appBg: '#282a36', surfaceBg: '#343746', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    preset: {
      primary: '#5e81ac', secondary: '#88c0d0', accent: '#a3be8c', useGradient: true,
      appBg: '#2e3440', surfaceBg: '#3b4252', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    preset: {
      primary: '#268bd2', secondary: '#2aa198', accent: '#b58900', useGradient: true,
      appBg: '#fdf6e3', surfaceBg: '#eee8d5', textColor: null, highlightBg: null,
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    preset: {
      primary: '#e11d48', secondary: '#be185d', accent: '#f59e0b', useGradient: true,
      appBg: '#fff1f2', surfaceBg: '#ffffff', textColor: null, highlightBg: null,
    },
  },
];

interface ThemeContextValue extends ThemeState {
  setTheme: (patch: Partial<ThemeState>) => void;
  resetCustom: () => void;
}

export const DEFAULT_THEME: ThemeState = {
  themeMode: 'light',
  primary: '#3b82f6',
  secondary: '#9333ea',
  accent: '#06b6d4',
  useGradient: true,
  appBg: CUSTOM_DEFAULTS.appBg,
  surfaceBg: CUSTOM_DEFAULTS.surfaceBg,
  textColor: null,
  highlightBg: null,
};

const STORAGE_KEY = 'timetrack-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readCache(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_THEME, ...parsed };
  } catch {
    return DEFAULT_THEME;
  }
}

function applyToDocument(state: ThemeState) {
  const root = document.documentElement;

  if (state.themeMode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  if (state.themeMode === 'custom') {
    root.classList.add('theme-custom');
  } else {
    root.classList.remove('theme-custom');
  }

  // Variables actives uniquement pour le mode custom ;
  // sinon, on rétablit les valeurs par défaut.
  const isCustom = state.themeMode === 'custom';
  const primary = isCustom ? state.primary : DEFAULT_THEME.primary;
  const secondary = isCustom ? state.secondary : DEFAULT_THEME.secondary;
  const accent = isCustom ? state.accent : DEFAULT_THEME.accent;
  const useGradient = isCustom ? state.useGradient : true;

  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-secondary', secondary);
  root.style.setProperty('--brand-accent', accent);
  root.style.setProperty(
    '--brand-fill',
    useGradient
      ? `linear-gradient(to right, ${primary}, ${secondary})`
      : primary
  );
  root.style.setProperty(
    '--brand-fill-br',
    useGradient
      ? `linear-gradient(to bottom right, ${primary}, ${secondary})`
      : primary
  );

  if (isCustom) {
    root.style.setProperty('--app-bg', state.appBg);
    root.style.setProperty('--surface-bg', state.surfaceBg);
    root.style.setProperty('--text-color', resolveTextColor(state));
    root.style.setProperty('--highlight-bg', resolveHighlightBg(state));
  } else {
    root.style.removeProperty('--app-bg');
    root.style.removeProperty('--surface-bg');
    root.style.removeProperty('--text-color');
    root.style.removeProperty('--highlight-bg');
  }
}

// Applique le cache immediatement au chargement du module pour eviter le flash.
if (typeof document !== 'undefined') {
  applyToDocument(readCache());
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<ThemeState>(() => readCache());

  // Sync au login : on charge depuis la DB (source de verite).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const next: ThemeState = {
        themeMode: data.theme_mode || (data.dark_mode ? 'dark' : 'light'),
        primary: data.theme_primary || DEFAULT_THEME.primary,
        secondary: data.theme_secondary || DEFAULT_THEME.secondary,
        accent: data.theme_accent || DEFAULT_THEME.accent,
        useGradient: data.theme_use_gradient ?? true,
        appBg: data.theme_app_bg || CUSTOM_DEFAULTS.appBg,
        surfaceBg: data.theme_surface_bg || CUSTOM_DEFAULTS.surfaceBg,
        textColor: data.theme_text_color || CUSTOM_DEFAULTS.textColor,
        highlightBg: data.theme_highlight_bg || CUSTOM_DEFAULTS.highlightBg,
      };
      setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Application + cache a chaque changement.
  useEffect(() => {
    applyToDocument(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  // Persistance DB debouncee.
  useEffect(() => {
    if (!user) return;
    const handle = setTimeout(() => {
      // .then() est obligatoire : le query builder est lazy
      supabase
        .from('user_preferences')
        .update({
          theme_mode: state.themeMode,
          theme_primary: state.primary,
          theme_secondary: state.secondary,
          theme_accent: state.accent,
          theme_use_gradient: state.useGradient,
          theme_app_bg: state.appBg,
          theme_surface_bg: state.surfaceBg,
          theme_text_color: state.textColor,
          theme_highlight_bg: state.highlightBg,
          dark_mode: state.themeMode === 'dark',
        })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.error('[theme] save error', error);
        });
    }, 350);
    return () => clearTimeout(handle);
  }, [state, user]);

  const setTheme = useCallback((patch: Partial<ThemeState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetCustom = useCallback(() => {
    setState((prev) => ({
      ...prev,
      primary: DEFAULT_THEME.primary,
      secondary: DEFAULT_THEME.secondary,
      accent: DEFAULT_THEME.accent,
      useGradient: true,
      appBg: CUSTOM_DEFAULTS.appBg,
      surfaceBg: CUSTOM_DEFAULTS.surfaceBg,
      textColor: CUSTOM_DEFAULTS.textColor,
      highlightBg: CUSTOM_DEFAULTS.highlightBg,
    }));
  }, []);

  return (
    <ThemeContext.Provider value={{ ...state, setTheme, resetCustom }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit etre utilise dans ThemeProvider');
  return ctx;
}
