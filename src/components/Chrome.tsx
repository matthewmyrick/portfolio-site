import type { ReactNode } from 'react';
import { TERMINALS, type TermType } from '../lib/terminals';

const BORDER = '1px solid rgb(var(--t-dim) / 0.25)';

function TrafficLights() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full" style={{ background: '#ff5f56' }} />
      <span className="h-3 w-3 rounded-full" style={{ background: '#ffbd2e' }} />
      <span className="h-3 w-3 rounded-full" style={{ background: '#27c93f' }} />
    </div>
  );
}

function Header({ term, title }: { term: TermType; title: string }) {
  if (term === 'iterm2') {
    return (
      <div className="relative flex h-9 items-center px-3" style={{ borderBottom: BORDER }}>
        <TrafficLights />
        <span className="t-dim pointer-events-none absolute inset-x-0 text-center text-sm">
          {title}
        </span>
      </div>
    );
  }
  if (term === 'warp') {
    return (
      <div className="flex h-9 items-center gap-2 px-3" style={{ borderBottom: BORDER }}>
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgb(var(--t-accent))' }} />
        <span className="t-dim text-sm">{title}</span>
      </div>
    );
  }
  // ghostty: minimal centered title
  return (
    <div className="flex h-8 items-center justify-center" style={{ borderBottom: BORDER }}>
      <span className="t-dim text-xs tracking-wide">{title}</span>
    </div>
  );
}

export function Chrome({
  term,
  opacity,
  children
}: {
  term: TermType;
  opacity: number;
  children: ReactNode;
}) {
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ fontFamily: TERMINALS[term].font }}
    >
      {/* Header stays opaque + crisp so the title bar is always readable. */}
      <div style={{ backgroundColor: 'rgb(var(--t-bg) / 0.95)' }}>
        <Header term={term} title={TERMINALS[term].title} />
      </div>
      {/* Body is translucent (no blur) so the wallpaper shows through clearly. */}
      <div className="min-h-0 flex-1" style={{ backgroundColor: `rgb(var(--t-bg) / ${opacity})` }}>
        {children}
      </div>
    </div>
  );
}
