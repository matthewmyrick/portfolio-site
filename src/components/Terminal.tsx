import { useEffect, useMemo, useRef } from 'react';
import { useStore, type Line } from '../store';
import { InputLine } from './InputLine';
import { Picker } from './Picker';
import { startSession } from '../commands';

export function Terminal() {
  const lines = useStore((s) => s.lines);
  const term = useStore((s) => s.term);
  const overlay = useStore((s) => s.overlay);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Show Tux + welcome on first load (guard handles StrictMode double-mount).
  useEffect(() => {
    if (useStore.getState().lines.length === 0) startSession();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);

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
      ) : (
        <div className={warp ? 'warp-block' : ''}>
          <InputLine />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
