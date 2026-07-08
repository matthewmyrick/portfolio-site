// Color palettes. Each channel is an "r g b" string so it can be used with
// alpha via CSS: rgb(var(--t-fg)) or rgb(var(--t-bg) / 0.8).

export interface Palette {
  bg: string;
  fg: string;
  dim: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  accent: string;
  cursor: string;
  selection: string;
}

export const THEMES = {
  'catppuccin-mocha': {
    label: 'Catppuccin Mocha',
    palette: {
      bg: '30 30 46',
      fg: '205 214 244',
      dim: '108 112 134',
      red: '243 139 168',
      green: '166 227 161',
      yellow: '249 226 175',
      blue: '137 180 250',
      magenta: '203 166 247',
      cyan: '148 226 213',
      accent: '166 227 161',
      cursor: '245 224 220',
      selection: '88 91 112'
    }
  },
  'catppuccin-macchiato': {
    label: 'Catppuccin Macchiato',
    palette: {
      bg: '36 39 58',
      fg: '202 211 245',
      dim: '110 115 141',
      red: '237 135 150',
      green: '166 218 149',
      yellow: '238 212 159',
      blue: '138 173 244',
      magenta: '198 160 246',
      cyan: '139 213 202',
      accent: '166 218 149',
      cursor: '244 219 214',
      selection: '91 96 120'
    }
  },
  'catppuccin-frappe': {
    label: 'Catppuccin Frappé',
    palette: {
      bg: '48 52 70',
      fg: '198 208 245',
      dim: '115 121 148',
      red: '231 130 132',
      green: '166 209 137',
      yellow: '229 200 144',
      blue: '140 170 238',
      magenta: '202 158 230',
      cyan: '129 200 190',
      accent: '166 209 137',
      cursor: '242 213 207',
      selection: '98 104 128'
    }
  },
  'catppuccin-latte': {
    label: 'Catppuccin Latte',
    palette: {
      bg: '239 241 245',
      fg: '76 79 105',
      dim: '140 143 161',
      red: '210 15 57',
      green: '64 160 43',
      yellow: '223 142 29',
      blue: '30 102 245',
      magenta: '136 57 239',
      cyan: '23 146 153',
      accent: '64 160 43',
      cursor: '220 138 120',
      selection: '220 224 232'
    }
  },
  dracula: {
    label: 'Dracula',
    palette: {
      bg: '40 42 54',
      fg: '248 248 242',
      dim: '98 114 164',
      red: '255 85 85',
      green: '80 250 123',
      yellow: '241 250 140',
      blue: '189 147 249',
      magenta: '255 121 198',
      cyan: '139 233 253',
      accent: '80 250 123',
      cursor: '248 248 242',
      selection: '68 71 90'
    }
  },
  gruvbox: {
    label: 'Gruvbox',
    palette: {
      bg: '40 40 40',
      fg: '235 219 178',
      dim: '146 131 116',
      red: '251 73 52',
      green: '184 187 38',
      yellow: '250 189 47',
      blue: '131 165 152',
      magenta: '211 134 155',
      cyan: '142 192 124',
      accent: '184 187 38',
      cursor: '235 219 178',
      selection: '80 73 69'
    }
  },
  'tokyo-night': {
    label: 'Tokyo Night',
    palette: {
      bg: '26 27 38',
      fg: '192 202 245',
      dim: '86 95 137',
      red: '247 118 142',
      green: '158 206 106',
      yellow: '224 175 104',
      blue: '122 162 247',
      magenta: '187 154 247',
      cyan: '125 207 255',
      accent: '158 206 106',
      cursor: '192 202 245',
      selection: '40 52 87'
    }
  },
  nord: {
    label: 'Nord',
    palette: {
      bg: '46 52 64',
      fg: '216 222 233',
      dim: '76 86 106',
      red: '191 97 106',
      green: '163 190 140',
      yellow: '235 203 139',
      blue: '129 161 193',
      magenta: '180 142 173',
      cyan: '136 192 208',
      accent: '163 190 140',
      cursor: '216 222 233',
      selection: '67 76 94'
    }
  },
  'iterm2-default': {
    label: 'iTerm2 Default',
    palette: {
      bg: '0 0 0',
      fg: '199 199 199',
      dim: '110 110 110',
      red: '201 27 0',
      green: '0 194 0',
      yellow: '199 196 0',
      blue: '74 110 255',
      magenta: '201 48 199',
      cyan: '0 197 199',
      accent: '0 194 0',
      cursor: '255 255 255',
      selection: '68 68 68'
    }
  },
  'warp-default': {
    label: 'Warp Default',
    palette: {
      bg: '29 33 40',
      fg: '199 205 214',
      dim: '90 98 110',
      red: '255 110 120',
      green: '132 217 142',
      yellow: '240 200 120',
      blue: '124 192 255',
      magenta: '198 160 246',
      cyan: '130 220 220',
      accent: '124 192 255',
      cursor: '199 205 214',
      selection: '45 52 64'
    }
  }
} as const;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];
export const DEFAULT_THEME: ThemeName = 'catppuccin-mocha';

export function isThemeName(s: string): s is ThemeName {
  return (THEME_NAMES as string[]).includes(s);
}

export function applyTheme(name: ThemeName): void {
  const p: Palette = THEMES[name].palette;
  const root = document.documentElement.style;
  root.setProperty('--t-bg', p.bg);
  root.setProperty('--t-fg', p.fg);
  root.setProperty('--t-dim', p.dim);
  root.setProperty('--t-red', p.red);
  root.setProperty('--t-green', p.green);
  root.setProperty('--t-yellow', p.yellow);
  root.setProperty('--t-blue', p.blue);
  root.setProperty('--t-magenta', p.magenta);
  root.setProperty('--t-cyan', p.cyan);
  root.setProperty('--t-accent', p.accent);
  root.setProperty('--t-cursor', p.cursor);
  root.setProperty('--t-selection', p.selection);
}
