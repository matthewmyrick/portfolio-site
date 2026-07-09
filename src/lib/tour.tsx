import type { ReactNode } from 'react';
import { useStore } from '../store';
import { runCommand } from '../executor';
import { shell } from './shell';

// `tour` — autopilot for visitors who will never type. Commands are typed
// character by character into the real input (live highlighting and all),
// executed, and paced; narration lines set the scene between chapters.
// ANY user key/click/touch cancels instantly.
//
// Structure: who Matthew is (the documents ARE the résumé) → the fun
// configured extras (theme flipped and flipped BACK, the train) → a live
// Kubernetes incident that the tour deliberately does NOT fix. That part
// is the visitor's job.

let active = false;

export const tourIsActive = () => active;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const st = () => useStore.getState();

type Step = { say: () => ReactNode; pause?: number } | { cmd: () => string; pause: number };

function steps(originalTheme: string): Step[] {
  return [
    {
      say: () => (
        <div className="t-dim mt-1">
          🏡 <span className="t-accent font-bold">Welcome to my homelab.</span> This site is served
          from a real machine in my NYC apartment — and this terminal is real enough to prove it.
          Sit back, I'll drive. <span className="t-yellow">Press any key</span> to take the wheel.
        </div>
      ),
      pause: 3000
    },
    {
      // The opening act: the cow states the thesis (tour-only rigged draw —
      // everyone else's fortune stays random).
      cmd: () => {
        shell.nextFortune = 'Latency is zero when you self-host in your apartment.';
        return 'fortune | cowsay';
      },
      pause: 3000
    },
    { cmd: () => 'whoami', pause: 1200 },
    { cmd: () => 'about', pause: 3400 },
    {
      say: () => (
        <div className="t-dim mt-1">
          Everything about me lives in this filesystem — look around like you would on any box:
        </div>
      ),
      pause: 1600
    },
    { cmd: () => 'ls', pause: 1800 },
    { cmd: () => 'cat resume.md | grep -i kubernetes', pause: 2600 },
    { cmd: () => 'ls projects/', pause: 1800 },
    { cmd: () => 'cat projects/README.md', pause: 2800 },
    { cmd: () => 'experience hadrius-ai', pause: 4200 },
    {
      say: () => (
        <div className="t-dim mt-1">
          grep it, <span className="t-green">fzf</span> it, <span className="t-green">vim</span> it
          (read-only — nice try), or <span className="t-green">open resume.pdf</span> for the real
          thing. Now for the toys:
        </div>
      ),
      pause: 2200
    },
    { cmd: () => 'theme dracula', pause: 2000 },
    { cmd: () => 'sl', pause: 800 }, // the train blocks via the job system; we wait it out
    { cmd: () => `theme ${originalTheme}`, pause: 1400 }, // and we put it back. manners.
    {
      say: () => <div className="t-dim mt-1">One more thing — let's check on the cluster:</div>,
      pause: 1600
    },
    { cmd: () => 'kubectl get pods', pause: 2000 },
    {
      say: () => (
        <div className="mt-1">
          <span className="t-red font-bold">
            🚨 Hold on — one of those pods is CrashLoopBackOff.
          </span>{' '}
          <span className="t-dim">
            A live incident, right now, on this very cluster. I'll leave the debugging to you…
          </span>
        </div>
      ),
      pause: 2600
    },
    // …and while you think about that, the closing pitch:
    { cmd: () => 'hire', pause: 2600 }
  ];
}

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

  try {
    for (const step of steps(originalTheme)) {
      if (!active) break;
      if ('say' in step) {
        st().print(step.say());
        await settle(step.pause ?? 1800);
      } else {
        if (!(await typeAndRun(step.cmd()))) break;
        await settle(step.pause);
      }
    }

    st().setCommand('', 0);
    st().setTheme(originalTheme); // safety net (the tour also types it back)
    if (active) {
      st().print(
        <div className="mt-2 max-w-2xl space-y-1">
          <div className="t-accent font-bold">
            🎬 That's the tour — the incident is yours now, SRE.
          </div>
          <div className="t-dim">
            Start with <span className="t-green">kubectl logs &lt;pod&gt;</span> or{' '}
            <span className="t-green">kubectl describe pod &lt;pod&gt;</span> — fix the limit and
            watch it roll out. Everything else: <span className="t-green">help -a</span>, and{' '}
            <span className="t-green">hire</span> if you like what you see.
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
