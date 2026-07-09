import { useEffect } from 'react';
import { useStore } from './store';
import { applyTheme } from './lib/themes';
import { Chrome } from './components/Chrome';
import { Terminal } from './components/Terminal';
import { CopyToast } from './components/CopyToast';

// Fixed badge while the autopilot runs: you can look and click, not type.
function TourBadge() {
  const on = useStore((s) => s.tour);
  if (!on) return null;
  return (
    <div
      className="fixed right-3 bottom-3 z-50 rounded px-3 py-1.5 text-xs font-bold shadow-lg"
      style={{ backgroundColor: 'rgb(var(--t-accent))', color: 'rgb(var(--t-bg))' }}
      role="status"
    >
      🎬 TOUR MODE — Esc or Ctrl+C to exit
    </div>
  );
}

export default function App() {
  const theme = useStore((s) => s.theme);
  const term = useStore((s) => s.term);
  const opacity = useStore((s) => s.opacity);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <>
      <div id="app-bg" />
      <div className="fixed inset-0">
        <Chrome term={term} opacity={opacity}>
          <Terminal />
        </Chrome>
      </div>
      <CopyToast />
      <TourBadge />
    </>
  );
}
