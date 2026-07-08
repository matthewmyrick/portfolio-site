import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useStore } from '../store';
import { runCommand } from '../executor';
import { complete, suggest } from '../lib/complete';
import { highlightClasses } from '../lib/highlight';
import { Prompt, CommandEcho } from './Prompt';
import { COMMAND_NAMES } from '../commands';
import { shell } from '../lib/shell';

const NO_GAME = { active: false, target: 0, attempts: 0, max: 7 };

function LiveText({
  text,
  cursor,
  cwd,
  ghost
}: {
  text: string;
  cursor: number;
  cwd: string;
  ghost: string;
}) {
  // Aliases are valid in command position too, so they highlight green.
  const classes = highlightClasses(text, new Set([...COMMAND_NAMES, ...shell.aliases.keys()]), cwd);
  const chars = [...text];
  return (
    <span className="break-words whitespace-pre-wrap">
      {chars.map((ch, i) => (
        <span key={i} className={`${classes[i] ?? ''} ${i === cursor ? 'mm-cursor' : ''}`}>
          {ch}
        </span>
      ))}
      {cursor >= text.length && <span className="mm-cursor"> </span>}
      {ghost && <span className="t-ghost">{ghost}</span>}
    </span>
  );
}

// All history entries containing `q`, most recent first.
function riMatches(q: string): string[] {
  if (!q) return [];
  const h = useStore.getState().history;
  const out: string[] = [];
  for (let i = h.length - 1; i >= 0; i--) if (h[i].includes(q)) out.push(h[i]);
  return out;
}

export function InputLine() {
  const command = useStore((s) => s.command);
  const cursor = useStore((s) => s.cursor);
  const cwd = useStore((s) => s.cwd);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ctrl+R reverse-i-search: query + which match (0 = most recent).
  const [risearch, setRisearch] = useState<{ q: string; idx: number } | null>(null);

  // Inline gray autofill suggestion (command/path, else most recent history).
  const ghost = useMemo(() => {
    if (!command || cursor < command.length) return '';
    let full = suggest(command, cwd);
    if (!full) {
      full =
        [...useStore.getState().history]
          .reverse()
          .find((c) => c.startsWith(command) && c !== command) ?? null;
    }
    return full && full.startsWith(command) ? full.slice(command.length) : '';
  }, [command, cursor, cwd]);

  const focus = () => inputRef.current?.focus();
  const syncCursor = () => useStore.getState().setCursor(inputRef.current?.selectionStart ?? 0);

  const setSelection = (pos: number) =>
    setTimeout(() => {
      if (inputRef.current) inputRef.current.selectionStart = inputRef.current.selectionEnd = pos;
    }, 0);

  const acceptGhost = () => {
    const st = useStore.getState();
    const full = st.command + ghost;
    st.setCommand(full, full.length);
    setSelection(full.length);
  };

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    useStore
      .getState()
      .setCommand(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  function navHistory(dir: -1 | 1) {
    const st = useStore.getState();
    const h = st.history;
    if (!h.length) return;
    let idx = st.historyIndex + dir;
    if (idx < 0) idx = 0;
    if (idx >= h.length) {
      st.setHistoryIndex(h.length);
      st.setCommand('', 0);
      return;
    }
    st.setHistoryIndex(idx);
    st.setCommand(h[idx], h[idx].length);
    setSelection(h[idx].length);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const st = useStore.getState();

    // Ctrl+R: enter reverse-i-search, or cycle to an older match.
    if (e.ctrlKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      setRisearch((r) => (r ? { ...r, idx: r.idx + 1 } : { q: '', idx: 0 }));
      return;
    }
    if (risearch) {
      e.preventDefault();
      const matches = riMatches(risearch.q);
      const match = matches.length ? matches[Math.min(risearch.idx, matches.length - 1)] : null;
      if (e.key === 'Enter') {
        setRisearch(null);
        if (match) {
          st.setCommand('', 0);
          runCommand(match);
        }
        return;
      }
      // →/←/End/Esc accept the match into the input line for editing.
      if (['Escape', 'ArrowLeft', 'ArrowRight', 'End'].includes(e.key)) {
        setRisearch(null);
        if (match) {
          st.setCommand(match, match.length);
          setSelection(match.length);
        }
        return;
      }
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) return setRisearch(null);
      if (e.key === 'Backspace') return setRisearch({ q: risearch.q.slice(0, -1), idx: 0 });
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setRisearch({ q: risearch.q + e.key, idx: 0 });
      }
      return; // swallow everything else while searching
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const v = st.command;
      st.setCommand('', 0);
      runCommand(v);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (ghost) return acceptGhost(); // accept the gray suggestion
      const r = complete(st.command, st.cwd);
      st.setCommand(r.value, r.cursor);
      if (r.list.length) {
        st.print(
          <div className="t-dim flex flex-wrap gap-x-4">
            {r.list.map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        );
      }
      setSelection(r.cursor);
      return;
    }
    // → at end of line accepts the ghost suggestion (fish-style).
    if (e.key === 'ArrowRight' && ghost && cursor >= command.length) {
      e.preventDefault();
      acceptGhost();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      navHistory(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navHistory(1);
      return;
    }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      st.clearLines();
      return;
    }
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      st.pushInput(<CommandEcho cwd={st.cwd} host={st.host} command={st.command + ' ^C'} />);
      if (st.game.active) st.setGame(NO_GAME);
      st.setCommand('', 0);
      shell.lastExit = 130; // interrupted
      return;
    }
    setTimeout(syncCursor, 0);
  }

  // Reverse-i-search renders exactly like bash: the prompt is replaced by
  // (reverse-i-search)`query': match — with the query highlighted in place.
  if (risearch) {
    const matches = riMatches(risearch.q);
    const match = matches.length ? matches[Math.min(risearch.idx, matches.length - 1)] : null;
    const at = match ? match.indexOf(risearch.q) : -1;
    return (
      <div className="relative cursor-text" onClick={focus}>
        <div className="pointer-events-none whitespace-pre-wrap">
          <span className="t-dim">({risearch.q && !match ? 'failed ' : ''}reverse-i-search)`</span>
          <span className="t-yellow">{risearch.q}</span>
          <span className="t-dim">': </span>
          {match && at >= 0 ? (
            <>
              {match.slice(0, at)}
              <span className="t-yellow font-bold">{risearch.q}</span>
              {match.slice(at + risearch.q.length)}
            </>
          ) : null}
          <span className="mm-cursor"> </span>
        </div>
        <input
          ref={inputRef}
          value={command}
          onChange={() => undefined}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="absolute inset-0 h-full w-full bg-transparent text-transparent caret-transparent outline-none"
          aria-label="reverse history search"
        />
      </div>
    );
  }

  return (
    <Prompt cwd={cwd}>
      <div className="relative cursor-text" onClick={focus}>
        <div className="pointer-events-none">
          <LiveText text={command} cursor={cursor} cwd={cwd} ghost={ghost} />
        </div>
        <input
          ref={inputRef}
          value={command}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onClick={syncCursor}
          onKeyUp={syncCursor}
          onSelect={syncCursor}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="absolute inset-0 h-full w-full bg-transparent text-transparent caret-transparent outline-none"
          aria-label="terminal input"
        />
      </div>
    </Prompt>
  );
}
