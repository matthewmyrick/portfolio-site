import { useEffect, useReducer, useRef } from 'react';
import { useStore } from '../../store';

// Fake htop: a fullscreen, gently-jittering process monitor whose workload
// is emotionally accurate. q / Esc quits.

interface Proc {
  pid: number;
  user: string;
  baseCpu: number;
  baseMem: number;
  time: string;
  cmd: string;
  state?: string; // Z = zombie, S = sleeping…
}

const PROCS: Proc[] = [
  { pid: 1, user: 'root', baseCpu: 0.1, baseMem: 0.4, time: '1:02.33', cmd: '/sbin/init' },
  {
    pid: 420,
    user: 'visitor',
    baseCpu: 97.0,
    baseMem: 12.1,
    time: '9999:59',
    cmd: 'imposter-syndrome'
  },
  {
    pid: 1337,
    user: 'visitor',
    baseCpu: 3.2,
    baseMem: 1.1,
    time: '420:69.0',
    cmd: 'coffee.service'
  },
  {
    pid: 2049,
    user: 'visitor',
    baseCpu: 0.0,
    baseMem: 0.0,
    time: '0:00.00',
    cmd: 'side-project',
    state: 'Z'
  },
  {
    pid: 3000,
    user: 'visitor',
    baseCpu: 0.0,
    baseMem: 8.8,
    time: '13:37.00',
    cmd: 'prod-incident (sleeping… for now)',
    state: 'S'
  },
  {
    pid: 4096,
    user: 'visitor',
    baseCpu: 22.4,
    baseMem: 41.7,
    time: '86:00.12',
    cmd: 'chrome --tab=847'
  },
  {
    pid: 5150,
    user: 'visitor',
    baseCpu: 1.8,
    baseMem: 24.9,
    time: '55:12.90',
    cmd: 'node_modules/'
  },
  { pid: 6502, user: 'root', baseCpu: 0.2, baseMem: 0.3, time: '2:22.22', cmd: 'dust.collector' },
  { pid: 7777, user: 'visitor', baseCpu: 0.4, baseMem: 0.1, time: '0:01.11', cmd: 'hope --daemon' },
  {
    pid: 8080,
    user: 'visitor',
    baseCpu: 4.4,
    baseMem: 3.2,
    time: '24:07.00',
    cmd: 'portfolio-web --self-hosted'
  }
];

const BAR_W = 28;

function Meter({ label, pct, text }: { label: string; pct: number; text: string }) {
  const filled = Math.round((pct / 100) * BAR_W);
  return (
    <div className="whitespace-pre">
      <span className="t-cyan font-bold">{`  ${label}`}</span>
      <span className="t-dim">[</span>
      <span className={pct > 80 ? 't-red' : pct > 50 ? 't-yellow' : 't-green'}>
        {'|'.repeat(filled)}
      </span>
      <span className="t-dim">
        {' '.repeat(BAR_W - filled)}
        {text.padStart(12)}]
      </span>
    </div>
  );
}

export function Htop() {
  const [tick, bump] = useReducer((x: number) => x + 1, 0);
  const started = useRef(Date.now()).current;

  useEffect(() => {
    const iv = setInterval(bump, 1000);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.altKey) return;
      if (/^F\d+$/.test(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape' || (e.ctrlKey && e.key === 'c')) {
        useStore.getState().setOverlay(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearInterval(iv);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  // Jitter per tick — seeded off tick so everything wiggles together.
  const j = (base: number, amp: number, salt: number) =>
    Math.max(
      0,
      base + Math.sin(tick * 1.7 + salt) * amp + (((tick * 7 + salt * 13) % 5) - 2) * 0.1
    );

  const cpuTotal = j(34, 6, 1);
  const memPct = j(62, 3, 2);
  const upSecs = Math.floor((Date.now() - started) / 1000) + 420 * 86400; // 420 days, of course
  const days = Math.floor(upSecs / 86400);
  const hh = String(Math.floor((upSecs % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((upSecs % 3600) / 60)).padStart(2, '0');
  const ss = String(upSecs % 60).padStart(2, '0');

  const rows = PROCS.map((p, i) => {
    const cpu = p.state === 'Z' ? 0 : Math.min(99.9, j(p.baseCpu, p.baseCpu > 50 ? 2.5 : 0.8, i));
    const mem = j(p.baseMem, 0.3, i + 20);
    return { ...p, cpu, mem };
  }).sort((a, b) => b.cpu - a.cpu);

  return (
    <div className="flex h-full flex-col text-[13px] leading-relaxed sm:text-sm">
      <div className="px-1 py-1">
        <Meter label="CPU" pct={cpuTotal} text={`${cpuTotal.toFixed(1)}%`} />
        <Meter label="Mem" pct={memPct} text={`5.1G/8.00G`} />
        <div className="t-dim whitespace-pre">
          {`  Tasks: `}
          <span className="t-fg">10</span>
          {`, 1 zombie · Load average: `}
          <span className="t-fg">{(cpuTotal / 25).toFixed(2)} 0.42 0.69</span>
          {` · Uptime: `}
          <span className="t-fg">{`${days} days, ${hh}:${mm}:${ss}`}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre">
        <div
          className="t-bg px-1 font-bold"
          style={{ backgroundColor: 'rgb(var(--t-accent))', color: 'rgb(var(--t-bg))' }}
        >
          {'  PID USER      S  CPU%  MEM%     TIME+  Command'}
        </div>
        {rows.map((p) => (
          <div key={p.pid} className="px-1">
            <span className="t-cyan">{String(p.pid).padStart(5)}</span>
            <span className="t-dim"> {p.user.padEnd(9)}</span>
            <span className={p.state === 'Z' ? 't-red' : 't-dim'}>
              {(p.state ?? 'R').padEnd(3)}
            </span>
            <span className={p.cpu > 80 ? 't-red font-bold' : p.cpu > 20 ? 't-yellow' : 't-fg'}>
              {p.cpu.toFixed(1).padStart(5)}
            </span>
            <span className="t-fg">{p.mem.toFixed(1).padStart(6)}</span>
            <span className="t-dim">{p.time.padStart(10)}</span>
            <span className={p.state === 'Z' ? 't-dim' : 't-fg'}>
              {'  ' + p.cmd + (p.state === 'Z' ? ' <defunct>' : '')}
            </span>
          </div>
        ))}
      </div>

      <div className="px-1" style={{ backgroundColor: 'rgb(var(--t-selection))' }}>
        <span className="t-dim">
          F1<span className="t-fg">Help(no)</span> F5<span className="t-fg">Tree(also no)</span> F9
          <span className="t-fg">Kill(you wouldn't)</span> q<span className="t-fg">Quit</span>
        </span>
      </div>
    </div>
  );
}
