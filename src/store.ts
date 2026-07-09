import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReactNode } from 'react';
import { DEFAULT_THEME, applyTheme, type ThemeName } from './lib/themes';
import { DEFAULT_TERM, type TermType } from './lib/terminals';
import { HOME } from './lib/fsops';

export interface Line {
  id: number;
  group: number;
  node: ReactNode;
  input?: boolean;
}

export interface GameState {
  active: boolean;
  target: number;
  attempts: number;
  max: number;
}

// Which interactive overlay/TUI is open (fzf finder, theme/term pickers,
// fullscreen apps like vim and less).
export type OverlayKind = 'fzf' | 'theme' | 'term' | 'vim' | 'less' | 'htop' | null;

const NO_GAME: GameState = { active: false, target: 0, attempts: 0, max: 7 };

let _id = 0;
const nid = () => ++_id;

interface State {
  lines: Line[];
  group: number;
  cwd: string;
  command: string;
  cursor: number;
  history: string[];
  historyIndex: number;
  theme: ThemeName;
  term: TermType;
  opacity: number;
  game: GameState;
  // Hidden-input mode (su password prompt): input renders no echo at all.
  secretInput: boolean;
  overlay: OverlayKind;
  host: string; // which "machine" we're on (ssh guestbox changes it)
  // A foreground "job" (animation like sl/ping). While set, the input line
  // is hidden and Ctrl+C cancels it — like a real blocking process.
  job: string | null;
}

interface Actions {
  setCommand: (v: string, cursor?: number) => void;
  setCursor: (n: number) => void;
  pushInput: (node: ReactNode) => void;
  print: (node: ReactNode) => void;
  printAll: (nodes: ReactNode[]) => void;
  clearLines: () => void;
  setCwd: (p: string) => void;
  setTheme: (t: ThemeName) => void;
  setTerm: (t: TermType) => void;
  setOpacity: (n: number) => void;
  pushHistory: (cmd: string) => void;
  setHistoryIndex: (n: number) => void;
  setGame: (g: GameState) => void;
  setSecretInput: (v: boolean) => void;
  setOverlay: (o: OverlayKind) => void;
  setHost: (h: string) => void;
  setJob: (j: string | null) => void;
}

export type Store = State & Actions;

export const useStore = create<Store>()(
  persist(
    (set) => ({
      lines: [],
      group: 0,
      cwd: HOME,
      command: '',
      cursor: 0,
      history: [],
      historyIndex: 0,
      theme: DEFAULT_THEME,
      term: DEFAULT_TERM,
      opacity: 0.85,
      game: NO_GAME,
      secretInput: false,
      overlay: null,
      host: 'portfolio',
      job: null,

      setCommand: (v, cursor) => set((s) => ({ command: v, cursor: cursor ?? s.cursor })),
      setCursor: (n) => set({ cursor: n }),

      pushInput: (node) =>
        set((s) => {
          const group = s.group + 1;
          return { group, lines: [...s.lines, { id: nid(), group, node, input: true }] };
        }),
      print: (node) => set((s) => ({ lines: [...s.lines, { id: nid(), group: s.group, node }] })),
      printAll: (nodes) =>
        set((s) => ({
          lines: [...s.lines, ...nodes.map((node) => ({ id: nid(), group: s.group, node }))]
        })),
      clearLines: () => set({ lines: [] }),

      setCwd: (p) => set({ cwd: p }),
      setTheme: (t) => {
        applyTheme(t);
        set({ theme: t });
      },
      setTerm: (t) => set({ term: t }),
      setOpacity: (n) => set({ opacity: Math.max(0.05, Math.min(1, n)) }),

      pushHistory: (cmd) =>
        set((s) => {
          const history = [...s.history, cmd].slice(-100);
          return { history, historyIndex: history.length };
        }),
      setHistoryIndex: (n) => set({ historyIndex: n }),
      setGame: (g) => set({ game: g }),
      setSecretInput: (v) => set({ secretInput: v }),
      setOverlay: (o) => set({ overlay: o }),
      setHost: (h) => set({ host: h }),
      setJob: (j) => set({ job: j })
    }),
    {
      name: 'mm-terminal',
      version: 5,
      // Default transparency changed across versions; reset saved opacity.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<State>;
        if (version < 5) state.opacity = 0.85;
        return state as Store;
      },
      partialize: (s) => ({
        theme: s.theme,
        term: s.term,
        opacity: s.opacity,
        history: s.history
      })
    }
  )
);
