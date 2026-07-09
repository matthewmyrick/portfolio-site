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

// Scrollback cap per pane — generous, but a runaway loop (or a very
// enthusiastic visitor) can't grow memory forever.
const MAX_SCROLLBACK = 5000;
const capped = (lines: Line[]): Line[] =>
  lines.length > MAX_SCROLLBACK ? lines.slice(-MAX_SCROLLBACK) : lines;

// One tmux-style pane = one independent session (scrollback, cwd, prompt,
// in-progress command, game). Theme/history/host/overlays are shared.
export interface PaneState {
  id: number;
  lines: Line[];
  group: number;
  cwd: string;
  command: string;
  cursor: number;
  historyIndex: number;
  game: GameState;
}

const newPane = (): PaneState => ({
  id: nid(),
  lines: [],
  group: 0,
  cwd: HOME,
  command: '',
  cursor: 0,
  historyIndex: 0,
  game: NO_GAME
});

// The top-level lines/cwd/command/… fields mirror the ACTIVE pane, so all
// existing readers keep working; every write syncs both places.
const mirror = (p: PaneState) => ({
  lines: p.lines,
  group: p.group,
  cwd: p.cwd,
  command: p.command,
  cursor: p.cursor,
  historyIndex: p.historyIndex,
  game: p.game
});

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
  // Autopilot running (shows the TOUR MODE badge; typing is blocked).
  tour: boolean;
  panes: PaneState[];
  activePane: number; // pane id
  splitDir: 'v' | 'h'; // orientation of the first split
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
  setTour: (v: boolean) => void;
  splitPane: (dir: 'v' | 'h') => void;
  closePane: () => void;
  focusPane: (delta: 1 | -1) => void;
  focusPaneId: (id: number) => void;
  resetPanes: () => void;
}

export type Store = State & Actions;

export const useStore = create<Store>()(
  persist(
    (set) => {
      const first = newPane();

      // Apply a patch to the active pane AND the top-level mirror.
      const sync = (s: State, patch: Partial<PaneState>): Partial<State> => ({
        ...(patch as Partial<State>),
        panes: s.panes.map((p) => (p.id === s.activePane ? { ...p, ...patch } : p))
      });

      const activate = (s: State, id: number): Partial<State> => {
        const next = s.panes.find((p) => p.id === id);
        return next ? { activePane: next.id, ...mirror(next) } : {};
      };

      return {
        ...mirror(first),
        history: [],
        theme: DEFAULT_THEME,
        term: DEFAULT_TERM,
        opacity: 0.85,
        secretInput: false,
        overlay: null,
        host: 'portfolio',
        job: null,
        tour: false,
        panes: [first],
        activePane: first.id,
        splitDir: 'v',

        setCommand: (v, cursor) => set((s) => sync(s, { command: v, cursor: cursor ?? s.cursor })),
        setCursor: (n) => set((s) => sync(s, { cursor: n })),

        pushInput: (node) =>
          set((s) => {
            const group = s.group + 1;
            return sync(s, {
              group,
              lines: capped([...s.lines, { id: nid(), group, node, input: true }])
            });
          }),
        print: (node) =>
          set((s) => sync(s, { lines: capped([...s.lines, { id: nid(), group: s.group, node }]) })),
        printAll: (nodes) =>
          set((s) =>
            sync(s, {
              lines: capped([
                ...s.lines,
                ...nodes.map((node) => ({ id: nid(), group: s.group, node }))
              ])
            })
          ),
        clearLines: () => set((s) => sync(s, { lines: [] })),

        setCwd: (p) => set((s) => sync(s, { cwd: p })),
        setTheme: (t) => {
          applyTheme(t);
          set({ theme: t });
        },
        setTerm: (t) => set({ term: t }),
        setOpacity: (n) => set({ opacity: Math.max(0.05, Math.min(1, n)) }),

        pushHistory: (cmd) =>
          set((s) => {
            const history = [...s.history, cmd].slice(-100);
            return { history, ...sync(s, { historyIndex: history.length }) };
          }),
        setHistoryIndex: (n) => set((s) => sync(s, { historyIndex: n })),
        setGame: (g) => set((s) => sync(s, { game: g })),
        setSecretInput: (v) => set({ secretInput: v }),
        setOverlay: (o) => set({ overlay: o }),
        setHost: (h) => set({ host: h }),
        setJob: (j) => set({ job: j }),
        setTour: (v) => set({ tour: v }),

        // ---- tmux-style panes ------------------------------------------------
        splitPane: (dir) =>
          set((s) => {
            if (s.panes.length >= 4) return {};
            const fresh = newPane();
            fresh.cwd = s.cwd; // new pane starts where you are, like tmux
            fresh.historyIndex = s.history.length;
            return {
              panes: [...s.panes, fresh],
              splitDir: s.panes.length === 1 ? dir : s.splitDir,
              activePane: fresh.id,
              ...mirror(fresh)
            };
          }),
        closePane: () =>
          set((s) => {
            if (s.panes.length < 2) return {};
            const idx = s.panes.findIndex((p) => p.id === s.activePane);
            const panes = s.panes.filter((p) => p.id !== s.activePane);
            const next = panes[Math.max(0, idx - 1)];
            return { panes, activePane: next.id, ...mirror(next) };
          }),
        focusPane: (delta) =>
          set((s) => {
            if (s.panes.length < 2) return {};
            const idx = s.panes.findIndex((p) => p.id === s.activePane);
            const next = s.panes[(idx + delta + s.panes.length) % s.panes.length];
            return activate(s, next.id);
          }),
        focusPaneId: (id) => set((s) => (id === s.activePane ? {} : activate(s, id))),
        resetPanes: () =>
          set((s) => {
            const keep = s.panes.find((p) => p.id === s.activePane) ?? s.panes[0];
            return { panes: [keep], activePane: keep.id, ...mirror(keep) };
          })
      };
    },
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
