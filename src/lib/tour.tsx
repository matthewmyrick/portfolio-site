import { useStore } from '../store';
import { runCommand } from '../executor';
import { crashPodName } from './cluster';

// `tour` — autopilot for visitors who will never type. Commands are typed
// character by character into the real input (live highlighting and all),
// executed, and paced. ANY user key/click/touch cancels instantly.

let active = false;

export const tourIsActive = () => active;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const st = () => useStore.getState();

interface Step {
  cmd: () => string;
  pause: number; // ms to linger on the output (jobs are awaited on top)
}

const STEPS: Step[] = [
  { cmd: () => 'about', pause: 2600 },
  { cmd: () => 'ls', pause: 1400 },
  { cmd: () => 'cat resume.md | grep -i kubernetes', pause: 2200 },
  { cmd: () => 'fortune | cowsay', pause: 2400 },
  { cmd: () => 'sl', pause: 800 }, // the train blocks via the job system; we wait it out
  { cmd: () => 'theme dracula', pause: 1600 },
  { cmd: () => 'kubectl get pods', pause: 2600 },
  { cmd: () => `kubectl logs ${crashPodName()}`, pause: 3000 },
  {
    cmd: () => 'kubectl set resources deployment portfolio-web --limits=memory=256Mi',
    pause: 2000
  },
  { cmd: () => 'kubectl rollout status deployment/portfolio-web', pause: 7500 },
  { cmd: () => 'kubectl get pods', pause: 2200 }
];

export async function startTour(): Promise<void> {
  if (active) return;
  active = true;
  const originalTheme = st().theme;

  const onUser = () => {
    active = false;
  };
  window.addEventListener('keydown', onUser, true);
  window.addEventListener('mousedown', onUser, true);
  window.addEventListener('touchstart', onUser, true);

  const typeAndRun = async (cmd: string): Promise<boolean> => {
    for (const ch of cmd) {
      if (!active) return false;
      const cur = st().command;
      st().setCommand(cur + ch, cur.length + 1);
      await sleep(35 + Math.random() * 55);
    }
    await sleep(400);
    if (!active) return false;
    const v = st().command;
    st().setCommand('', 0);
    runCommand(v);
    return true;
  };

  const settle = async (pause: number) => {
    // Wait for any foreground job (sl!) to finish, then linger on the output.
    while (active && st().job) await sleep(120);
    const t0 = Date.now();
    while (active && Date.now() - t0 < pause) await sleep(100);
  };

  st().print(
    <div className="t-dim mt-1">
      🎬 Sit back — the terminal will drive. <span className="t-yellow">Press any key</span> to take
      the wheel at any time.
    </div>
  );
  await sleep(1600);

  try {
    for (const step of STEPS) {
      if (!active) break;
      if (!(await typeAndRun(step.cmd()))) break;
      await settle(step.pause);
    }

    st().setCommand('', 0);
    st().setTheme(originalTheme);
    if (active) {
      st().print(
        <div className="mt-2 max-w-2xl space-y-1">
          <div className="t-accent font-bold">🎬 That's the tour — now it's your turn.</div>
          <div className="t-dim">
            Try <span className="t-green">help -a</span> for everything (easter eggs included),{' '}
            <span className="t-green">vim about.md</span> if you're brave, or{' '}
            <span className="t-green">hire</span> if you're hiring.
          </div>
        </div>
      );
    } else {
      st().print(
        <div className="t-dim mt-1">🎬 Tour cancelled — it's all yours. (Try `help`.)</div>
      );
    }
  } finally {
    active = false;
    window.removeEventListener('keydown', onUser, true);
    window.removeEventListener('mousedown', onUser, true);
    window.removeEventListener('touchstart', onUser, true);
  }
}
