import type { ThemeName } from './themes';

// "Terminal types" are full personalities: window chrome (Chrome.tsx), a default
// theme, a font, and a prompt style (Prompt.tsx). Switching restarts the session
// so it feels like opening a different terminal app.
export type PromptStyle = 'powerline' | 'classic' | 'warp';

interface TerminalDef {
  label: string;
  title: string;
  hint: string;
  theme: ThemeName;
  font: string;
  prompt: PromptStyle;
}

export const TERMINALS = {
  ghostty: {
    label: 'Ghostty',
    title: 'visitor@portfolio — ghostty',
    hint: 'Minimal, rounded, pastel (Catppuccin)',
    theme: 'catppuccin-mocha',
    font: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
    prompt: 'powerline'
  },
  iterm2: {
    label: 'iTerm2',
    title: 'visitor@portfolio — -zsh',
    hint: 'Classic macOS, black ANSI, traffic lights',
    theme: 'iterm2-default',
    font: "Menlo, Monaco, 'SF Mono', monospace",
    prompt: 'classic'
  },
  warp: {
    label: 'Warp',
    title: 'visitor@portfolio',
    hint: 'Modern blue blocks + input bar',
    theme: 'warp-default',
    font: "'Fira Code', ui-monospace, SFMono-Regular, monospace",
    prompt: 'warp'
  }
} as const satisfies Record<string, TerminalDef>;

export type TermType = keyof typeof TERMINALS;

export const TERM_NAMES = Object.keys(TERMINALS) as TermType[];
export const DEFAULT_TERM: TermType = 'ghostty';

export function isTermType(s: string): s is TermType {
  return (TERM_NAMES as string[]).includes(s);
}
