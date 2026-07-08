import { useEffect, useReducer, useRef } from 'react';
import { useStore } from '../store';
import { displayPath, writeFile } from '../lib/fsops';

// A small modal editor in the spirit of vim: NORMAL / INSERT modes, hjkl and
// friends, `:w` persists to the in-memory session filesystem, `:q` to leave.
// Fullscreen — it replaces the terminal screen like a real TUI app.

type Mode = 'normal' | 'insert' | 'cmdline';

export interface VimFile {
  path: string | null; // absolute path; null = scratch buffer (`:w` → E32)
  lines: string[];
  newFile: boolean;
  // Optional hook fired after a successful :w (used by e.g. `kubectl edit`).
  onWrite?: (content: string) => void;
}

let pendingFile: VimFile = { path: null, lines: [''], newFile: false };

export function openVim(file: VimFile): void {
  pendingFile = file;
  useStore.getState().setOverlay('vim');
}

interface Snap {
  lines: string[];
  row: number;
  col: number;
}

interface EditorState {
  lines: string[];
  row: number;
  col: number;
  mode: Mode;
  cmdline: string;
  message: string;
  modified: boolean;
  pendingKey: '' | 'd' | 'y' | 'g';
  yank: string[] | null; // line-wise register (dd / yy)
  undo: Snap[];
}

const isWordCh = (c: string | undefined) => !!c && /\S/.test(c);

function nextWord(lines: string[], row: number, col: number): { row: number; col: number } {
  let r = row;
  let c = col;
  while (c < lines[r].length && isWordCh(lines[r][c])) c++;
  while (r < lines.length) {
    while (c < lines[r].length && !isWordCh(lines[r][c])) c++;
    if (c < lines[r].length) return { row: r, col: c };
    r++;
    c = 0;
    if (r < lines.length && lines[r].length === 0) return { row: r, col: 0 };
  }
  const last = lines.length - 1;
  return { row: last, col: Math.max(0, lines[last].length - 1) };
}

function prevWord(lines: string[], row: number, col: number): { row: number; col: number } {
  let r = row;
  let c = col - 1;
  while (r >= 0) {
    if (c < 0) {
      r--;
      if (r < 0) break;
      c = lines[r].length - 1;
      continue;
    }
    while (c >= 0 && !isWordCh(lines[r][c])) c--;
    if (c < 0) continue;
    while (c > 0 && isWordCh(lines[r][c - 1])) c--;
    return { row: r, col: c };
  }
  return { row: 0, col: 0 };
}

export function Vim() {
  const file = useRef(pendingFile).current;
  const st = useRef<EditorState>({
    lines: file.lines.length ? [...file.lines] : [''],
    row: 0,
    col: 0,
    mode: 'normal',
    cmdline: '',
    message: file.newFile
      ? `"${file.path ? displayPath(file.path) : '[No Name]'}" [New File]`
      : `"${file.path ? displayPath(file.path) : '[No Name]'}" ${file.lines.length}L, ${file.lines.join('\n').length + 1}C`,
    modified: false,
    pendingKey: '',
    yank: null,
    undo: []
  }).current;
  const [tick, bump] = useReducer((x: number) => x + 1, 0);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [tick]);

  useEffect(() => {
    const close = () => useStore.getState().setOverlay(null);

    const clampCol = (insert = false) => {
      const len = st.lines[st.row].length;
      const max = insert ? len : Math.max(0, len - 1);
      if (st.col > max) st.col = max;
      if (st.col < 0) st.col = 0;
    };

    const snap = () => {
      st.undo.push({ lines: [...st.lines], row: st.row, col: st.col });
      if (st.undo.length > 100) st.undo.shift();
    };

    const write = (): boolean => {
      if (!file.path) {
        st.message = 'E32: No file name';
        return false;
      }
      const content = st.lines.join('\n') + '\n';
      if (!writeFile(file.path, content)) {
        st.message = `E212: Can't open file for writing: ${displayPath(file.path)}`;
        return false;
      }
      st.modified = false;
      st.message = `"${displayPath(file.path)}" ${st.lines.length}L, ${content.length}C written`;
      file.onWrite?.(content);
      return true;
    };

    const execCmdline = (cmd: string) => {
      st.mode = 'normal';
      st.cmdline = '';
      if (!cmd) return;
      if (/^\d+$/.test(cmd)) {
        st.row = Math.min(Math.max(0, parseInt(cmd, 10) - 1), st.lines.length - 1);
        clampCol();
        return;
      }
      switch (cmd) {
        case 'w':
        case 'w!':
          write();
          break;
        case 'q':
          if (st.modified) st.message = 'E37: No write since last change (add ! to override)';
          else close();
          break;
        case 'q!':
          close();
          break;
        case 'wq':
        case 'wq!':
        case 'x':
          if (write()) close();
          break;
        default:
          st.message = `E492: Not an editor command: ${cmd}`;
      }
    };

    const normalKey = (key: string) => {
      const line = () => st.lines[st.row];

      // Two-key sequences: dd / yy / gg.
      if (st.pendingKey) {
        const pk = st.pendingKey;
        st.pendingKey = '';
        if (pk === 'd' && key === 'd') {
          snap();
          st.yank = [line()];
          st.lines.splice(st.row, 1);
          if (st.lines.length === 0) st.lines = [''];
          if (st.row >= st.lines.length) st.row = st.lines.length - 1;
          clampCol();
          st.modified = true;
          return;
        }
        if (pk === 'y' && key === 'y') {
          st.yank = [line()];
          st.message = '1 line yanked';
          return;
        }
        if (pk === 'g' && key === 'g') {
          st.row = 0;
          st.col = 0;
          return;
        }
        return; // unrecognized sequence — drop it
      }

      switch (key) {
        case 'h':
        case 'ArrowLeft':
        case 'Backspace':
          st.col = Math.max(0, st.col - 1);
          break;
        case 'l':
        case 'ArrowRight':
          st.col = Math.min(Math.max(0, line().length - 1), st.col + 1);
          break;
        case 'j':
        case 'ArrowDown':
          st.row = Math.min(st.lines.length - 1, st.row + 1);
          clampCol();
          break;
        case 'k':
        case 'ArrowUp':
          st.row = Math.max(0, st.row - 1);
          clampCol();
          break;
        case 'Enter':
          st.row = Math.min(st.lines.length - 1, st.row + 1);
          st.col = 0;
          break;
        case '0':
          st.col = 0;
          break;
        case '$':
          st.col = Math.max(0, line().length - 1);
          break;
        case 'w': {
          const p = nextWord(st.lines, st.row, st.col);
          st.row = p.row;
          st.col = p.col;
          break;
        }
        case 'b': {
          const p = prevWord(st.lines, st.row, st.col);
          st.row = p.row;
          st.col = p.col;
          break;
        }
        case 'G':
          st.row = st.lines.length - 1;
          clampCol();
          break;
        case 'g':
        case 'd':
        case 'y':
          st.pendingKey = key;
          break;
        case 'x':
          if (line().length > 0) {
            snap();
            st.lines[st.row] = line().slice(0, st.col) + line().slice(st.col + 1);
            clampCol();
            st.modified = true;
          }
          break;
        case 'p':
          if (st.yank) {
            snap();
            st.lines.splice(st.row + 1, 0, ...st.yank);
            st.row = st.row + 1;
            st.col = 0;
            st.modified = true;
          }
          break;
        case 'u': {
          const prev = st.undo.pop();
          if (prev) {
            st.lines = prev.lines;
            st.row = prev.row;
            st.col = prev.col;
            st.modified = true;
            st.message = 'undo';
          } else {
            st.message = 'Already at oldest change';
          }
          break;
        }
        case 'i':
          snap();
          st.mode = 'insert';
          break;
        case 'a':
          snap();
          st.col = Math.min(line().length, st.col + 1);
          st.mode = 'insert';
          break;
        case 'A':
          snap();
          st.col = line().length;
          st.mode = 'insert';
          break;
        case 'I': {
          snap();
          const m = line().match(/\S/);
          st.col = m ? (m.index ?? 0) : 0;
          st.mode = 'insert';
          break;
        }
        case 'o':
          snap();
          st.lines.splice(st.row + 1, 0, '');
          st.row = st.row + 1;
          st.col = 0;
          st.mode = 'insert';
          st.modified = true;
          break;
        case 'O':
          snap();
          st.lines.splice(st.row, 0, '');
          st.col = 0;
          st.mode = 'insert';
          st.modified = true;
          break;
        case ':':
          st.mode = 'cmdline';
          st.cmdline = '';
          st.message = '';
          break;
      }
    };

    const insertKey = (e: globalThis.KeyboardEvent) => {
      const line = st.lines[st.row];
      if (e.key === 'Escape') {
        st.mode = 'normal';
        st.col = Math.max(0, st.col - 1);
        clampCol();
        return;
      }
      if (e.key === 'Enter') {
        st.lines.splice(st.row, 1, line.slice(0, st.col), line.slice(st.col));
        st.row++;
        st.col = 0;
        st.modified = true;
        return;
      }
      if (e.key === 'Backspace') {
        if (st.col > 0) {
          st.lines[st.row] = line.slice(0, st.col - 1) + line.slice(st.col);
          st.col--;
          st.modified = true;
        } else if (st.row > 0) {
          const prev = st.lines[st.row - 1];
          st.lines.splice(st.row - 1, 2, prev + line);
          st.row--;
          st.col = prev.length;
          st.modified = true;
        }
        return;
      }
      if (e.key === 'Tab') {
        st.lines[st.row] = line.slice(0, st.col) + '  ' + line.slice(st.col);
        st.col += 2;
        st.modified = true;
        return;
      }
      if (e.key === 'ArrowLeft') return void (st.col = Math.max(0, st.col - 1));
      if (e.key === 'ArrowRight') return void (st.col = Math.min(line.length, st.col + 1));
      if (e.key === 'ArrowUp') {
        st.row = Math.max(0, st.row - 1);
        return clampCol(true);
      }
      if (e.key === 'ArrowDown') {
        st.row = Math.min(st.lines.length - 1, st.row + 1);
        return clampCol(true);
      }
      if (e.key.length === 1) {
        st.lines[st.row] = line.slice(0, st.col) + e.key + line.slice(st.col);
        st.col++;
        st.modified = true;
      }
    };

    const cmdlineKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        st.mode = 'normal';
        st.cmdline = '';
        return;
      }
      if (e.key === 'Enter') return execCmdline(st.cmdline);
      if (e.key === 'Backspace') {
        if (st.cmdline === '') st.mode = 'normal';
        else st.cmdline = st.cmdline.slice(0, -1);
        return;
      }
      if (e.key.length === 1) st.cmdline += e.key;
    };

    const onKey = (e: globalThis.KeyboardEvent) => {
      // Leave browser shortcuts alone — except Ctrl+[ which is Escape in vim.
      if (e.metaKey || e.altKey) return;
      if (/^F\d+$/.test(e.key)) return; // F5 / F12 etc. stay with the browser
      if (e.ctrlKey) {
        if (e.key === '[') {
          e.preventDefault();
          if (st.mode === 'insert' || st.mode === 'cmdline') {
            st.mode = 'normal';
            st.cmdline = '';
          }
          bump();
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (st.mode === 'normal') {
        if (e.key === 'Escape') st.pendingKey = '';
        else normalKey(e.key);
      } else if (st.mode === 'insert') {
        insertKey(e);
      } else {
        cmdlineKey(e);
      }
      bump();
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = file.path ? displayPath(file.path) : '[No Name]';
  const gutterW = String(st.lines.length).length;
  const tildes = Math.max(0, 14 - st.lines.length);

  return (
    <div className="flex h-full flex-col" data-tick={tick}>
      {/* buffer */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1 whitespace-pre">
        {st.lines.map((line, i) => {
          const cur = i === st.row;
          return (
            <div key={i} ref={cur ? cursorRef : undefined} className="flex">
              <span
                className={`${cur ? 't-yellow' : 't-dim'} mr-2 shrink-0 text-right select-none`}
              >
                {String(i + 1).padStart(gutterW)}
              </span>
              <span className="min-w-0">
                {cur ? (
                  <>
                    {line.slice(0, st.col)}
                    <span className="mm-cursor">{line[st.col] ?? ' '}</span>
                    {line.slice(st.col + 1)}
                  </>
                ) : (
                  line || ' '
                )}
              </span>
            </div>
          );
        })}
        {Array.from({ length: tildes }).map((_, i) => (
          <div key={`~${i}`} className="t-dim select-none">
            ~
          </div>
        ))}
      </div>

      {/* statusline */}
      <div
        className="flex justify-between px-2 font-bold"
        style={{ backgroundColor: 'rgb(var(--t-selection))' }}
      >
        <span>
          {name}
          {st.modified ? ' [+]' : ''}
        </span>
        <span>
          {st.row + 1},{st.col + 1}
        </span>
      </div>

      {/* cmdline / mode / message row */}
      <div className="h-6 px-2">
        {st.mode === 'cmdline' ? (
          <span>
            :{st.cmdline}
            <span className="mm-cursor"> </span>
          </span>
        ) : st.mode === 'insert' ? (
          <span className="font-bold">-- INSERT --</span>
        ) : (
          <span className="whitespace-pre-wrap">{st.message}</span>
        )}
      </div>
    </div>
  );
}
