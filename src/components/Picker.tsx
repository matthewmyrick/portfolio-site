import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useStore, type OverlayKind } from '../store';
import { walkFiles, displayPath, HOME } from '../lib/fsops';
import { THEMES, THEME_NAMES, applyTheme, type ThemeName } from '../lib/themes';
import { TERMINALS, TERM_NAMES, type TermType } from '../lib/terminals';
import { finishFzf } from '../executor';
import { startSession } from '../commands';

interface Item {
  value: string;
  label: string;
  hint?: string;
}

// Subsequence fuzzy match. Returns a score (lower = better) or -1 for no match.
function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let lastIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (lastIdx !== -1) score += ti - lastIdx;
      lastIdx = ti;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

function itemsFor(kind: OverlayKind): Item[] {
  if (kind === 'fzf') {
    return walkFiles(HOME).map((f) => ({ value: displayPath(f.path), label: displayPath(f.path) }));
  }
  if (kind === 'theme') {
    return THEME_NAMES.map((n) => ({ value: n, label: THEMES[n].label, hint: n }));
  }
  if (kind === 'term') {
    return TERM_NAMES.map((n) => ({
      value: n,
      label: TERMINALS[n].label,
      hint: TERMINALS[n].hint
    }));
  }
  return [];
}

const PROMPTS: Record<Exclude<OverlayKind, null>, string> = {
  fzf: 'files',
  theme: 'theme',
  term: 'terminal',
  vim: 'vim', // never shown — vim/less/htop render their own fullscreen UI, not the Picker
  less: 'less',
  htop: 'htop'
};

// A terminal-native picker (like fzf): renders inline inside the terminal,
// results above a count line and a query prompt at the bottom. No floating GUI.
export function Picker() {
  const kind = useStore((s) => s.overlay);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const selRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const committed = useRef(false);
  const originalTheme = useRef<ThemeName>(useStore.getState().theme).current;

  const allItems = useMemo(() => itemsFor(kind), [kind]);
  const results = useMemo(() => {
    if (!query) return allItems;
    return allItems
      .map((it) => ({ it, score: fuzzyScore(query, it.label + ' ' + (it.hint ?? '')) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score || a.it.label.localeCompare(b.it.label))
      .map((r) => r.it);
  }, [allItems, query]);

  const clamped = Math.min(selected, Math.max(0, results.length - 1));

  // Live preview for theme/term: recolor as you move the selection.
  useEffect(() => {
    const item = results[clamped];
    if (!item) return;
    if (kind === 'theme') applyTheme(item.value as ThemeName);
    if (kind === 'term') applyTheme(TERMINALS[item.value as TermType].theme);
  }, [clamped, kind, results]);

  // Revert preview if the user cancels without choosing.
  useEffect(() => {
    return () => {
      if (!committed.current) applyTheme(originalTheme);
    };
  }, [originalTheme]);

  // Start on the currently-active theme/term so opening doesn't jump.
  useEffect(() => {
    const st = useStore.getState();
    const current = kind === 'theme' ? st.theme : kind === 'term' ? st.term : null;
    if (current) {
      const i = allItems.findIndex((it) => it.value === current);
      if (i >= 0) setSelected(i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // Keep the highlighted row in view.
  useEffect(() => {
    selRef.current?.scrollIntoView({ block: 'nearest' });
  }, [clamped]);

  // On open: focus the picker input and scroll it into view.
  useEffect(() => {
    inputRef.current?.focus();
    rootRef.current?.scrollIntoView({ block: 'nearest' });
  }, [kind]);

  // Single Escape-to-close handler (capture phase → fires first, one press).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        useStore.getState().setOverlay(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  if (!kind) return null;

  const close = () => useStore.getState().setOverlay(null);

  const choose = (item: Item | undefined) => {
    if (!item) return close();
    committed.current = true;
    const st = useStore.getState();
    st.setOverlay(null);
    if (kind === 'fzf') {
      finishFzf(item.value);
    } else if (kind === 'theme') {
      st.setTheme(item.value as ThemeName);
      st.print(
        <span>
          Theme set to <span className="t-accent font-bold">{item.label}</span>
        </span>
      );
    } else if (kind === 'term') {
      const t = item.value as TermType;
      st.setTerm(t);
      st.setTheme(TERMINALS[t].theme);
      startSession();
    }
  };

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Escape is handled globally (capture phase) so it always closes on one press.
    if (e.key === 'ArrowDown' || (e.ctrlKey && (e.key === 'n' || e.key === 'j'))) {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && (e.key === 'p' || e.key === 'k'))) {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[clamped]);
    }
  }

  return (
    <div ref={rootRef} className="mt-1 flex max-h-[55vh] flex-col">
      {/* results (scrollable, top-to-bottom so ↑/↓ match) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-1">
        {results.length === 0 && <div className="t-dim px-2">no matches</div>}
        {results.map((it, i) => {
          const active = i === clamped;
          return (
            <div
              key={it.value}
              ref={active ? selRef : undefined}
              className="flex cursor-pointer items-baseline gap-2 px-2"
              style={active ? { backgroundColor: 'rgb(var(--t-selection) / 0.6)' } : undefined}
              onMouseEnter={() => setSelected(i)}
              onClick={() => choose(it)}
            >
              <span className={active ? 't-accent' : 't-dim'}>{active ? '❯' : ' '}</span>
              <span className={active ? 't-accent font-bold' : 't-fg'}>{it.label}</span>
              {it.hint && it.hint !== it.label && <span className="t-dim text-xs">{it.hint}</span>}
            </div>
          );
        })}
      </div>

      {/* count line */}
      <div className="t-dim px-2 text-xs">
        {results.length}/{allItems.length} · {PROMPTS[kind]} · ↑/↓ move · enter select · esc cancel
      </div>

      {/* query prompt */}
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="t-accent">{'>'}</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="t-fg w-full bg-transparent outline-none"
          aria-label={`filter ${PROMPTS[kind]}`}
        />
      </div>
    </div>
  );
}
