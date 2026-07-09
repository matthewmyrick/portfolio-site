import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, type Line, type PaneState } from '../store';
import { InputLine } from './InputLine';
import { Picker } from './Picker';
import { Vim } from './Vim';
import { Less } from './Less';
import { Htop } from './eggs/Htop';
import { startSession, printWelcome } from '../commands';
import { Prompt, HighlightedText } from './Prompt';

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
      data-pane-id={pane.id}
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
      {active ? (
        overlay ? (
          <Picker />
        ) : job ? null : (
          <div className={warp ? 'warp-block' : ''}>
            <InputLine />
          </div>
        )
      ) : (
        // Inactive panes keep a frozen (non-blinking) prompt so they still
        // look like terminals — including any half-typed command.
        <div className="opacity-60">
          <Prompt cwd={pane.cwd}>
            <HighlightedText text={pane.command} cwd={pane.cwd} />
          </Prompt>
        </div>
      )}
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
      <span className="hidden sm:inline">
        {host} · ^b then: % \" split · arrows/o move · x close
      </span>
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
  const [prefixArmed, setPrefixArmed] = useState(false);

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

  // tmux prefix: Ctrl+b arms for 2s (shown as a ^B badge), then % " o x
  // and arrows act on panes. Arrows move focus GEOMETRICALLY — up/down/
  // left/right pick the nearest pane in that direction, whatever the layout.
  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const disarm = () => {
      prefixAt.current = 0;
      setPrefixArmed(false);
      clearTimeout(clearTimer);
    };
    const arm = () => {
      prefixAt.current = Date.now();
      setPrefixArmed(true);
      clearTimeout(clearTimer);
      clearTimer = setTimeout(disarm, 2000);
    };

    const moveDir = (dir: 'left' | 'right' | 'up' | 'down') => {
      const s = useStore.getState();
      const els = [...document.querySelectorAll<HTMLElement>('[data-pane-id]')];
      const cur = els.find((el) => Number(el.dataset.paneId) === s.activePane);
      if (!cur) return;
      const cr = cur.getBoundingClientRect();
      let best: { id: number; d: number } | null = null;
      for (const el of els) {
        const id = Number(el.dataset.paneId);
        if (id === s.activePane) continue;
        const r = el.getBoundingClientRect();
        const dx = r.left + r.width / 2 - (cr.left + cr.width / 2);
        const dy = r.top + r.height / 2 - (cr.top + cr.height / 2);
        const inDir =
          dir === 'left' ? dx < -1 : dir === 'right' ? dx > 1 : dir === 'up' ? dy < -1 : dy > 1;
        if (!inDir) continue;
        const d = Math.abs(dx) + Math.abs(dy);
        if (!best || d < best.d) best = { id, d };
      }
      if (best) s.focusPaneId(best.id);
    };

    const onKey = (e: globalThis.KeyboardEvent) => {
      const s = useStore.getState();
      // No tmux keys inside fullscreen apps or foreground jobs.
      if (s.overlay === 'vim' || s.overlay === 'less' || s.overlay === 'htop' || s.job) return;
      if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        e.stopPropagation();
        arm();
        return;
      }
      // Bare modifier presses (Shift for %/") must not consume the prefix.
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      if (Date.now() - prefixAt.current > 2000) return;
      const act = () => {
        e.preventDefault();
        e.stopPropagation();
        disarm();
      };
      if (e.key === '%' || e.key === '"') {
        act();
        if (s.panes.length >= 4) {
          s.print(<span className="t-dim">tmux: max 4 panes — close one first (Ctrl+b x)</span>);
          return;
        }
        s.splitPane(e.key === '%' ? 'v' : 'h');
        printWelcome();
      } else if (e.key === 'o') {
        act();
        s.focusPane(1);
      } else if (e.key === 'ArrowLeft') {
        act();
        moveDir('left');
      } else if (e.key === 'ArrowRight') {
        act();
        moveDir('right');
      } else if (e.key === 'ArrowUp') {
        act();
        moveDir('up');
      } else if (e.key === 'ArrowDown') {
        act();
        moveDir('down');
      } else if (e.key === 'x') {
        act();
        s.closePane();
      } else {
        disarm();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      clearTimeout(clearTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const prefixBadge = prefixArmed ? (
    <div
      className="fixed right-3 bottom-8 z-50 rounded px-2 py-1 text-xs font-bold shadow-lg"
      style={{ backgroundColor: 'rgb(var(--t-yellow))', color: 'rgb(var(--t-bg))' }}
    >
      ^B — % split | " stack | arrows move | x close
    </div>
  ) : null;

  if (panes.length === 1) {
    return (
      <>
        <PaneView pane={panes[0]} active solo warp={warp} />
        {prefixBadge}
      </>
    );
  }

  // Layouts: 2 panes follow the first split's direction; 3 panes keep the
  // FIRST pane long (full height or width) with the other two sharing the
  // remaining half; 4 panes are quadrants.
  const grid =
    panes.length === 2
      ? splitDir === 'v'
        ? 'grid-cols-2'
        : 'grid-rows-2'
      : 'grid-cols-2 grid-rows-2';
  const span = (i: number): string => {
    if (panes.length !== 3 || i !== 0) return '';
    return splitDir === 'v' ? 'row-span-2' : 'col-span-2';
  };

  return (
    <div className="flex h-full flex-col">
      <div className={`grid min-h-0 flex-1 ${grid}`}>
        {panes.map((p, i) => (
          <div key={p.id} className={`min-h-0 ${span(i)}`}>
            <PaneView pane={p} active={p.id === activePane} solo={false} warp={warp} />
          </div>
        ))}
      </div>
      <TmuxBar panes={panes} activeId={activePane} />
      {prefixBadge}
    </div>
  );
}
