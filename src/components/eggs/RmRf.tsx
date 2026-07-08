import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { walkFiles, HOME } from '../../lib/fsops';

// `rm -rf /` — a harmless, heart-stopping meltdown: files stream by,
// the screen glitches, the kernel panics, and the session "reboots".
// Nothing is ever actually deleted.

const SYSTEM_CASUALTIES = [
  '/usr/bin/bash',
  '/usr/bin/ls',
  '/usr/bin/cat',
  '/usr/bin/grep',
  '/usr/bin/vim',
  '/usr/lib/libc.so.6',
  '/usr/lib/libssl.so.3',
  '/etc/passwd',
  '/etc/fstab',
  '/etc/hostname',
  '/boot/vmlinuz-linux',
  '/boot/initramfs-linux.img',
  '/var/log/journal',
  '/var/lib/pacman/local',
  '/opt/homework (never opened)',
  '/usr/share/doc (unread, obviously)',
  '/usr/bin/sudo (ironic)',
  '/usr/bin/rm'
];

const PANIC = [
  '[  666.000000] Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000000',
  '[  666.000001] CPU: 0 PID: 1 Comm: init Not tainted 6.9.0-arch1-1 #1',
  '[  666.000002] Hardware name: Apartment/Closet, BIOS HOPE 04/01/2020',
  '[  666.000003] Call Trace: <TASK> panic+0x180/0x330  do_exit+0x8ab/0xb00  __x64_sys_exit_group',
  '[  666.000004] ---[ end Kernel panic - not syncing: Attempted to kill init! ]---'
];

type Phase = 'deleting' | 'panic' | 'reboot' | 'cancelled';

export function RmRf({ onReboot }: { onReboot: () => void }) {
  const [n, setN] = useState(0); // how many doomed paths shown
  const [phase, setPhase] = useState<Phase>('deleting');
  const [countdown, setCountdown] = useState(3);
  const wrapRef = useRef<HTMLDivElement>(null);
  const doomed = useRef<string[]>([]);

  if (doomed.current.length === 0) {
    // Your actual (virtual) files go first — it has to feel personal.
    doomed.current = [...walkFiles(HOME).map((f) => f.path), ...SYSTEM_CASUALTIES];
  }

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let i = 0;
    const iv = setInterval(() => {
      if (useStore.getState().job !== 'rmrf') {
        clearInterval(iv);
        setPhase('cancelled');
        return;
      }
      i += 1 + Math.floor(Math.random() * 2);
      setN(Math.min(i, doomed.current.length));
      if (i >= doomed.current.length) {
        clearInterval(iv);
        setPhase('panic');
        document.body.classList.add('mm-glitch');
        timers.push(setTimeout(() => document.body.classList.remove('mm-glitch'), 950));
        timers.push(setTimeout(() => setPhase('reboot'), 1200));
        [3, 2, 1].forEach((c, idx) => {
          timers.push(setTimeout(() => setCountdown(c - 1), 1200 + (idx + 1) * 700));
        });
        timers.push(
          setTimeout(
            () => {
              const st = useStore.getState();
              document.body.classList.remove('mm-glitch');
              if (st.job === 'rmrf') {
                st.setJob(null);
                onReboot();
              }
            },
            1200 + 3 * 700 + 400
          )
        );
      }
    }, 45);
    return () => {
      clearInterval(iv);
      timers.forEach(clearTimeout);
      document.body.classList.remove('mm-glitch');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wrapRef.current?.scrollIntoView({ block: 'nearest' });
  }, [n, phase, countdown]);

  return (
    <div ref={wrapRef} className="whitespace-pre-wrap">
      {doomed.current.slice(0, n).map((p, i) => (
        <div key={i} className="t-dim">
          removed '{p}'
        </div>
      ))}
      {phase === 'cancelled' && (
        <div className="mt-1">
          ^C
          <div className="t-yellow">
            rm: interrupted. just kidding — nothing was ever deleted. everything is fine. 🙂
          </div>
        </div>
      )}
      {(phase === 'panic' || phase === 'reboot') && (
        <div className="mt-1">
          {PANIC.map((l, i) => (
            <div key={i} className="t-red font-bold">
              {l}
            </div>
          ))}
        </div>
      )}
      {phase === 'reboot' && (
        <div className="t-yellow mt-1">
          Rebooting{countdown > 0 ? ` in ${countdown}...` : '...'}
        </div>
      )}
    </div>
  );
}
