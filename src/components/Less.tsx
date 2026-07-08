import { useEffect, useReducer, useRef, type ReactNode } from 'react';
import { useStore } from '../store';

// A `less`-style pager: fullscreen, line-based scrolling, `/` search with
// n/N navigation, q to quit. Fed by `less <file>` or as a pipe sink.

interface PagerDoc {
  title: string;
  lines: string[];
}

let pendingDoc: PagerDoc = { title: '', lines: [] };

export function openLess(title: string, text: string): void {
  pendingDoc = { title, lines: text.replace(/\n$/, '').split('\n') };
  useStore.getState().setOverlay('less');
}

interface PagerState {
  top: number;
  rows: number;
  searchInput: string | null; // non-null while typing a /search
  query: string;
  matches: number[]; // line indexes with a hit
  message: string;
}

function highlight(line: string, re: RegExp | null): ReactNode {
  if (!re) return line || ' ';
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  re.lastIndex = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(
      <span key={i++} className="t-string font-bold">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts.length ? parts : ' ';
}

export function Less() {
  const doc = useRef(pendingDoc).current;
  const st = useRef<PagerState>({
    top: 0,
    rows: 20,
    searchInput: null,
    query: '',
    matches: [],
    message: ''
  }).current;
  const [tick, bump] = useReducer((x: number) => x + 1, 0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);

  const total = doc.lines.length;

  // Measure how many text rows fit (re-measure on resize).
  useEffect(() => {
    const measure = () => {
      const h = bodyRef.current?.clientHeight ?? 0;
      const lh = probeRef.current?.offsetHeight || 21;
      st.rows = Math.max(1, Math.floor(h / lh));
      bump();
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const close = () => useStore.getState().setOverlay(null);

    const runSearch = (q: string) => {
      st.query = q;
      st.matches = [];
      if (!q) return;
      let re: RegExp;
      try {
        re = new RegExp(q, 'i');
      } catch {
        st.message = `invalid pattern: ${q}`;
        return;
      }
      doc.lines.forEach((l, i) => {
        if (re.test(l)) st.matches.push(i);
      });
      if (!st.matches.length) st.message = `Pattern not found: ${q}`;
    };

    const jump = (dir: 1 | -1) => {
      if (!st.matches.length) {
        st.message = st.query ? `Pattern not found: ${st.query}` : 'No previous search';
        return;
      }
      const next =
        dir === 1
          ? (st.matches.find((i) => i > st.top) ?? st.matches[0])
          : ([...st.matches].reverse().find((i) => i < st.top) ??
            st.matches[st.matches.length - 1]);
      st.top = Math.min(Math.max(0, total - st.rows), next);
    };

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.altKey || e.ctrlKey) return;
      if (/^F\d+$/.test(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const clamp = () => {
        st.top = Math.min(Math.max(0, st.top), Math.max(0, total - st.rows));
      };
      st.message = '';

      // typing a /search
      if (st.searchInput !== null) {
        if (e.key === 'Escape') st.searchInput = null;
        else if (e.key === 'Enter') {
          runSearch(st.searchInput);
          st.searchInput = null;
          jump(1);
        } else if (e.key === 'Backspace') {
          st.searchInput = st.searchInput.slice(0, -1);
        } else if (e.key.length === 1) {
          st.searchInput += e.key;
        }
        return bump();
      }

      switch (e.key) {
        case 'q':
        case 'Q':
        case 'Escape':
          return close();
        case 'j':
        case 'ArrowDown':
        case 'Enter':
          st.top++;
          break;
        case 'k':
        case 'ArrowUp':
          st.top--;
          break;
        case ' ':
        case 'f':
        case 'PageDown':
          st.top += st.rows;
          break;
        case 'b':
        case 'PageUp':
          st.top -= st.rows;
          break;
        case 'd':
          st.top += Math.floor(st.rows / 2);
          break;
        case 'u':
          st.top -= Math.floor(st.rows / 2);
          break;
        case 'g':
        case 'Home':
          st.top = 0;
          break;
        case 'G':
        case 'End':
          st.top = total;
          break;
        case '/':
          st.searchInput = '';
          break;
        case 'n':
          jump(1);
          break;
        case 'N':
          jump(-1);
          break;
      }
      clamp();
      bump();
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let re: RegExp | null = null;
  if (st.query) {
    try {
      re = new RegExp(st.query, 'gi');
    } catch {
      re = null;
    }
  }

  const end = Math.min(total, st.top + st.rows);
  const atEnd = end >= total;
  const pct = total === 0 ? 100 : Math.round((end / total) * 100);

  return (
    <div className="flex h-full flex-col" data-tick={tick}>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-hidden px-1 py-1 whitespace-pre">
        {/* invisible probe to measure one row's height */}
        <div ref={probeRef} className="invisible absolute">
          X
        </div>
        {doc.lines.slice(st.top, end).map((line, i) => (
          <div key={st.top + i}>{highlight(line, re)}</div>
        ))}
        {Array.from({ length: Math.max(0, st.rows - (end - st.top)) }).map((_, i) => (
          <div key={`~${i}`} className="t-dim select-none">
            ~
          </div>
        ))}
      </div>

      {/* status / prompt row */}
      <div
        className="flex justify-between px-2"
        style={{ backgroundColor: 'rgb(var(--t-selection))' }}
      >
        <span>
          {st.searchInput !== null ? (
            <span>
              /{st.searchInput}
              <span className="mm-cursor"> </span>
            </span>
          ) : st.message ? (
            st.message
          ) : (
            <span className="font-bold">{doc.title}</span>
          )}
        </span>
        <span className="t-dim">
          lines {total === 0 ? 0 : st.top + 1}-{end}/{total} · {atEnd ? '(END)' : `${pct}%`} · q
          quit · / search
        </span>
      </div>
    </div>
  );
}
