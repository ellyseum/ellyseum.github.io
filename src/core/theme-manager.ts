export type ThemeId = 'galaxy' | 'classic-white' | 'classic-dark';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  isClassic: boolean;
}

export const THEMES: ThemeDefinition[] = [
  { id: 'galaxy', label: 'Galaxy', isClassic: false },
  { id: 'classic-white', label: 'Classic White', isClassic: true },
  { id: 'classic-dark', label: 'Classic Dark', isClassic: true },
];

const STORAGE_KEY = 'ellyseum_theme';

export class ThemeManager {
  private currentTheme: ThemeId;
  private onThemeChange?: (theme: ThemeId) => void;

  constructor(onThemeChange?: (theme: ThemeId) => void) {
    this.onThemeChange = onThemeChange;
    this.currentTheme = this.getStoredTheme();
  }

  getTheme(): ThemeId {
    return this.currentTheme;
  }

  isClassic(): boolean {
    return this.currentTheme !== 'galaxy';
  }

  setTheme(theme: ThemeId): void {
    const prev = this.currentTheme;
    if (prev === theme) return;

    const prevDef = THEMES.find(t => t.id === prev)!;
    const nextDef = THEMES.find(t => t.id === theme)!;

    this.currentTheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);

    // Classic -> Galaxy requires reload (WebGL needs fresh init)
    if (prevDef.isClassic && !nextDef.isClassic) {
      window.location.reload();
      return;
    }

    // Apply theme attributes
    this.applyTheme(theme);
    this.onThemeChange?.(theme);
  }

  applyTheme(theme?: ThemeId): void {
    const t = theme ?? this.currentTheme;
    const html = document.documentElement;

    if (t === 'galaxy') {
      html.removeAttribute('data-theme');
      html.classList.remove('classic');
      html.style.backgroundColor = '#010108';
      // Update meta theme-color
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#010108');
    } else {
      html.setAttribute('data-theme', t);
      html.classList.add('classic');
      // Set background from computed variable
      const bg = t === 'classic-white' ? '#ffffff' : '#272822';
      html.style.backgroundColor = bg;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', bg);
    }
  }

  private getStoredTheme(): ThemeId {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES.some(t => t.id === stored)) {
        return stored as ThemeId;
      }
    } catch { /* ignore */ }
    return 'galaxy';
  }
}

/** Get current theme synchronously (for use before ThemeManager is created) */
export function getStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['galaxy', 'classic-white', 'classic-dark'].includes(stored)) {
      return stored as ThemeId;
    }
  } catch { /* ignore */ }
  return 'galaxy';
}
