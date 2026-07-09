import { useEffect, useMemo, useRef } from 'react';
import { useStore, type Line, type PaneState } from '../store';
import { InputLine } from './InputLine';
import { Picker } from './Picker';
import { Vim } from './Vim';
import { Less } from './Less';
import { Htop } from './eggs/Htop';
import { startSession } from '../commands';

// One pane's scrollback + (when active) the input line or an inline picker.
function PaneView({
  pane,
  active,
  solo,
  warp
}: {
  pane: PaneState;
  active: boolean;
  solo: boolean;
  warp: boolean;
}) {
  const overlay = useStore((s) => s.overlay);
  const job = useStore((s) => s.job);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [pane.lines]);

  // When the mobile software keyboard opens/closes it resizes the viewport —
  // keep the prompt in view instead of leaving it hidden under the keyboard.
  useEffect(() => {
    if (!active) return;
    const onResize = () => bottomRef.current?.scrollIntoView({ block: 'end' });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active]);

  // Coming back from a fullscreen app (vim/less/htop) remounts the scrollback
  // — land at the prompt, not wherever the browser restores scroll to.
  useEffect(() => {
    if (!overlay) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [overlay]);

  // Group consecutive lines by their command group (used for Warp blocks).
  const groups = useMemo(() => {
    const out: { group: number; items: Line[] }[] = [];
    for (const l of pane.lines) {
      const last = out[out.length - 1];
      if (last && last.group === l.group) last.items.push(l);
      else out.push({ group: l.group, items: [l] });
    }
    return out;
  }, [pane.lines]);

  const onMouseDown = () => {
    if (!active) useStore.getState().focusPaneId(pane.id);
  };

  const focusInput = () => {
    if (!active || useStore.getState().overlay) return;
    // Don't steal focus while text is selected — focusing the input would
    // clear the selection before copy-on-select can grab it.
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    scrollRef.current?.querySelector('input')?.focus();
  };

  return (
    <div
      ref={scrollRef}
      onMouseDown={onMouseDown}
      onClick={focusInput}
      className={`term-screen t-fg relative h-full min-h-0 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed sm:text-sm ${
        solo ? '' : active ? 'mm-pane mm-pane-active' : 'mm-pane'
      }`}
    >
      {groups.map((g) => (
        <div key={g.group} className={warp && g.group > 0 ? 'warp-block' : 'mb-1'}>
          {g.items.map((l) => (
            <div key={l.id}>{l.node}</div>
          ))}
        </div>
      ))}
      {active &&
        (overlay ? (
          <Picker />
        ) : job ? null : (
          <div className={warp ? 'warp-block' : ''}>
            <InputLine />
          </div>
        ))}
      <div ref={bottomRef} />
    </div>
  );
}

// tmux-style status bar, shown while split.
function TmuxBar({ panes, activeId }: { panes: PaneState[]; activeId: number }) {
  const host = useStore((s) => s.host);
  return (
    <div
      className="flex shrink-0 justify-between px-2 font-bold"
      style={{ backgroundColor: 'rgb(var(--t-green))', color: 'rgb(var(--t-bg))' }}
    >
      <span>
        [portfolio] {panes.map((p, i) => `${i}:mmsh${p.id === activeId ? '*' : ''}`).join('  ')}
      </span>
      <span className="hidden sm:inline">{host} · ^b % split · ^b o next · ^b x close</span>
    </div>
  );
}

export function Terminal() {
  const term = useStore((s) => s.term);
  const overlay = useStore((s) => s.overlay);
  const job = useStore((s) => s.job);
  const panes = useStore((s) => s.panes);
  const activePane = useStore((s) => s.activePane);
  const splitDir = useStore((s) => s.splitDir);
  const prefixAt = useRef(0);

  // While a foreground job (animation) runs, input is hidden and Ctrl+C kills it.
  useEffect(() => {
    if (!job) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        useStore.getState().setJob(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [job]);

  // tmux prefix: Ctrl+b arms for 2s, then % " o x / arrows act on panes.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const s = useStore.getState();
      // No tmux keys inside fullscreen apps or foreground jobs.
      if (s.overlay === 'vim' || s.overlay === 'less' || s.overlay === 'htop' || s.job) return;
      if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        e.stopPropagation();
        prefixAt.current = Date.now();
        return;
      }
      // Bare modifier presses (Shift for %/") must not consume the prefix.
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      if (Date.now() - prefixAt.current > 2000) return;
      prefixAt.current = 0;
      const act = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === '%') {
        act();
        s.splitPane('v');
      } else if (e.key === '"') {
        act();
        s.splitPane('h');
      } else if (e.key === 'o' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        act();
        s.focusPane(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        act();
        s.focusPane(-1);
      } else if (e.key === 'x') {
        act();
        s.closePane();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Show the welcome on first load (guard handles StrictMode double-mount).
  useEffect(() => {
    if (useStore.getState().lines.length === 0) startSession();
  }, []);

  // Nudge idle first-time visitors toward the guided tour: 45s with no
  // typed command → a dim hint. Any keypress before then cancels it.
  useEffect(() => {
    const t = setTimeout(() => {
      const s = useStore.getState();
      if (s.history.length === 0 && !s.overlay && !s.job) {
        s.print(
          <div className="t-dim mt-2">
            psst — not sure where to start? type <span className="t-green">tour</span> and the
            terminal drives itself.
          </div>
        );
      }
    }, 45000);
    const cancel = () => clearTimeout(t);
    window.addEventListener('keydown', cancel, { once: true, capture: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', cancel, true);
    };
  }, []);

  const warp = term === 'warp';

  // vim/less/htop are fullscreen apps: they take over the whole screen
  // (scrollback stays in the store and reappears when they exit).
  if (overlay === 'vim' || overlay === 'less' || overlay === 'htop') {
    return (
      <div className="term-screen t-fg h-full text-[13px] leading-relaxed sm:text-sm">
        {overlay === 'vim' ? <Vim /> : overlay === 'less' ? <Less /> : <Htop />}
      </div>
    );
  }

  if (panes.length === 1) {
    return <PaneView pane={panes[0]} active solo warp={warp} />;
  }

  const grid =
    panes.length === 2
      ? splitDir === 'v'
        ? 'grid-cols-2'
        : 'grid-rows-2'
      : 'grid-cols-2 grid-rows-2';

  return (
    <div className="flex h-full flex-col">
      <div className={`grid min-h-0 flex-1 ${grid}`}>
        {panes.map((p) => (
          <PaneView key={p.id} pane={p} active={p.id === activePane} solo={false} warp={warp} />
        ))}
      </div>
      <TmuxBar panes={panes} activeId={activePane} />
    </div>
  );
}
