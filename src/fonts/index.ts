// ============================================================
// sketchmark — Font Registry
// ============================================================

export interface FontDef {
  family:   string;   // CSS font-family value
  url?:     string;   // Google Fonts or any CDN URL to inject
  loaded?:  boolean;
}

// built-in named fonts — user can reference these by short name
export const BUILTIN_FONTS: Record<string, FontDef> = {
  // hand-drawn
  caveat: {
    family: "'Caveat', cursive",
    url:    'https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600&display=swap',
  },
  handlee: {
    family: "'Handlee', cursive",
    url:    'https://fonts.googleapis.com/css2?family=Handlee&display=swap',
  },
  'indie-flower': {
    family: "'Indie Flower', cursive",
    url:    'https://fonts.googleapis.com/css2?family=Indie+Flower&display=swap',
  },
  'patrick-hand': {
    family: "'Patrick Hand', cursive",
    url:    'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap',
  },

  // clean / readable
  'dm-mono': {
    family: "'DM Mono', monospace",
    url:    'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap',
  },
  'jetbrains': {
    family: "'JetBrains Mono', monospace",
    url:    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap',
  },
  'instrument': {
    family: "'Instrument Serif', serif",
    url:    'https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap',
  },
  'playfair': {
    family: "'Playfair Display', serif",
    url:    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&display=swap',
  },

  // system fallbacks (no URL needed)
  system:  { family: 'system-ui, sans-serif' },
  mono:    { family: "'Courier New', monospace" },
  serif:   { family: 'Georgia, serif' },
};

// default — what renders when no font is specified
export const DEFAULT_FONT = 'system-ui, sans-serif';

// resolve a short name or pass-through a quoted CSS family
export function resolveFont(nameOrFamily: string): string {
  const key = nameOrFamily.toLowerCase().trim();
  if (BUILTIN_FONTS[key]) return BUILTIN_FONTS[key].family;
  return nameOrFamily;   // treat as raw CSS font-family
}

// inject a <link> into <head> for a built-in font (browser only)
export function loadFont(name: string): void {
  if (typeof document === 'undefined') return;
  const key = name.toLowerCase().trim();
  const def  = BUILTIN_FONTS[key];
  if (!def?.url || def.loaded) return;
  if (document.querySelector(`link[data-sketchmark-font="${key}"]`)) return;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = def.url;
  link.setAttribute('data-sketchmark-font', key);
  document.head.appendChild(link);
  def.loaded = true;
}

// user registers their own font (already loaded via CSS/link)
export function registerFont(name: string, family: string, url?: string): void {
  BUILTIN_FONTS[name.toLowerCase()] = { family, url };
  if (url) loadFont(name);
}