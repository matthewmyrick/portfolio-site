import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { eggResult, setEggResult } from './cache';

// Fake `pacman -S <pkg>` — we ARE on an Arch wallpaper, after all.
// Time-based staged output with an animated progress bar, then the point.

const BAR_W = 24;

function bar(pct: number): string {
  const filled = Math.round((pct / 100) * BAR_W);
  return `[${'#'.repeat(filled)}${'-'.repeat(BAR_W - filled)}] ${String(Math.round(pct)).padStart(3)}%`;
}

interface PacmanEnd {
  t: number;
  cancelled: boolean;
}

export function PacmanInstall({ id, pkg, update }: { id: string; pkg: string; update?: boolean }) {
  const prior = eggResult<PacmanEnd>(id);
  const [t, setT] = useState(prior?.t ?? 0);
  const [cancelled, setCancelled] = useState(prior?.cancelled ?? false);
  const doneRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const TOTAL = update ? 2600 : 3600;

  useEffect(() => {
    if (prior) return; // finished on a previous mount — render the ending only
    const start = Date.now();
    let latest = 0;
    const finish = (wasCancelled: boolean) => {
      clearInterval(iv);
      doneRef.current = true;
      setEggResult(id, { t: wasCancelled ? latest : TOTAL, cancelled: wasCancelled });
      const st = useStore.getState();
      if (st.job === 'pacman') st.setJob(null);
    };
    const iv = setInterval(() => {
      if (useStore.getState().job !== 'pacman') {
        // Ctrl+C — pacman prints its cancellation line.
        if (!doneRef.current) setCancelled(true);
        return finish(true);
      }
      latest = Date.now() - start;
      setT(latest);
      if (latest >= TOTAL) finish(false);
    }, 50);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wrapRef.current?.scrollIntoView({ block: 'end' });
  }, [t]);

  const rows: React.ReactNode[] = [];
  const dim = (s: string, k: string) => (
    <div key={k} className="t-dim">
      {s}
    </div>
  );

  if (update) {
    rows.push(dim(':: Synchronizing package databases...', 'sync'));
    if (t > 500) rows.push(<div key="core"> core is up to date</div>);
    if (t > 800) rows.push(<div key="extra"> extra is up to date</div>);
    if (t > 1100) rows.push(<div key="multilib"> multilib is up to date</div>);
    if (t > 1600) rows.push(dim(':: Starting full system upgrade...', 'up'));
    if (t > 2200) {
      rows.push(
        <div key="nothing">
          {' '}
          there is nothing to do. System is up to date. <span className="t-dim">Obviously.</span>
        </div>
      );
    }
  } else {
    rows.push(dim('resolving dependencies...', 'deps'));
    if (t > 400) rows.push(dim('looking for conflicting packages...', 'conf'));
    if (t > 800) {
      rows.push(
        <div key="pkgs" className="mt-1">
          Packages (1) <span className="t-cyan">{pkg}-1.0.0-1</span>
        </div>,
        <div key="size" className="mb-1">
          Total Installed Size: <span className="t-yellow">4.20 MiB</span>
        </div>
      );
    }
    if (t > 1200) {
      rows.push(
        <div key="proceed">
          <span className="t-blue font-bold">::</span> Proceed with installation? [Y/n]{' '}
          {t > 1600 ? 'y' : ''}
        </div>
      );
    }
    if (t > 1900) {
      const pct = Math.min(100, ((t - 1900) / 1500) * 100);
      rows.push(
        <div key="bar" className="whitespace-pre">
          (1/1) installing {pkg.padEnd(18).slice(0, 18)} {bar(pct)}
        </div>
      );
    }
    if (t >= TOTAL) {
      rows.push(
        <div key="btw" className="mt-1">
          <span className="t-blue font-bold">::</span>{' '}
          <span className="t-accent font-bold">btw, I use Arch</span>
        </div>
      );
    }
  }

  if (cancelled) {
    rows.push(
      <div key="cancel">
        <span className="t-blue font-bold">::</span> Operation cancelled
      </div>
    );
  }

  return <div ref={wrapRef}>{rows}</div>;
}
