import { useEffect, useMemo, useRef } from 'react';
import { useStore, type Line } from '../store';
import { InputLine } from './InputLine';
import { Picker } from './Picker';
import { Vim } from './Vim';
import { Less } from './Less';
import { Htop } from './eggs/Htop';
import { startSession } from '../commands';

export function Terminal() {
  const lines = useStore((s) => s.lines);
  const term = useStore((s) => s.term);
  const overlay = useStore((s) => s.overlay);
  const job = useStore((s) => s.job);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  // Show Tux + welcome on first load (guard handles StrictMode double-mount).
  useEffect(() => {
    if (useStore.getState().lines.length === 0) startSession();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);

  // When the mobile software keyboard opens/closes it resizes the viewport —
  // keep the prompt in view instead of leaving it hidden under the keyboard.
  useEffect(() => {
    const onResize = () => bottomRef.current?.scrollIntoView({ block: 'end' });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Group consecutive lines by their command group (used for Warp blocks).
  const groups = useMemo(() => {
    const out: { group: number; items: Line[] }[] = [];
    for (const l of lines) {
      const last = out[out.length - 1];
      if (last && last.group === l.group) last.items.push(l);
      else out.push({ group: l.group, items: [l] });
    }
    return out;
  }, [lines]);

  const focusInput = () => {
    if (useStore.getState().overlay) return;
    scrollRef.current?.querySelector('input')?.focus();
  };

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

  return (
    <div
      ref={scrollRef}
      onClick={focusInput}
      className="term-screen t-fg relative h-full overflow-y-auto px-4 py-3 text-[13px] leading-relaxed sm:text-sm"
    >
      {groups.map((g) => (
        <div key={g.group} className={warp && g.group > 0 ? 'warp-block' : 'mb-1'}>
          {g.items.map((l) => (
            <div key={l.id}>{l.node}</div>
          ))}
        </div>
      ))}
      {overlay ? (
        <Picker />
      ) : job ? null : (
        <div className={warp ? 'warp-block' : ''}>
          <InputLine />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
