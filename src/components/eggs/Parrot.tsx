import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { eggResult, setEggResult } from './cache';

// `curl parrot.live` — an ASCII party parrot, in your terminal, cycling
// through theme colors. Runs until Ctrl+C (or 60s, for everyone's sake).

const FRAMES = [
  String.raw`
       .----.
      / o    \__
     |    \      \
      \    \______|
       \          |
      / \________/
     /  /  |   |
    (  (   |   |
`,
  String.raw`
        .----.
    __ /    o \
   /      /    |
  |______/    /
  |          /
   \________/ \
     |   |  \  \
     |   |   )  )
`,
  String.raw`
       .----.
      /  o   \__
     |     \     \
      \     \_____|
       \         |
       /\_______/
      /  / |  |
     (  (  |  |
`,
  String.raw`
        .----.
    __ / o    \
   /       /   |
  |_______/   /
  |          /
   \________/\
     |   |   \ \
     |   |    ) )
`
];

const COLORS = ['t-red', 't-yellow', 't-green', 't-cyan', 't-blue', 't-magenta'];
const FRAME_MS = 120;
const MAX_MS = 60_000;

export function Parrot({ id }: { id: string }) {
  const prior = eggResult<boolean>(id) === true;
  const [frame, setFrame] = useState(0);
  const [done, setDone] = useState(prior);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prior) return; // the party already ended — render the epilogue only
    wrapRef.current?.scrollIntoView({ block: 'nearest' });
    const start = Date.now();
    let f = 0;
    const finish = () => {
      clearInterval(iv);
      setDone(true);
      setEggResult(id, true);
      const st = useStore.getState();
      if (st.job === 'parrot') st.setJob(null);
    };
    const iv = setInterval(() => {
      if (useStore.getState().job !== 'parrot' || Date.now() - start > MAX_MS) return finish();
      f++;
      setFrame(f);
    }, FRAME_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) {
    return (
      <div ref={wrapRef}>
        <div>^C</div>
        <div className="t-dim">the parrot thanks you for partying responsibly.</div>
      </div>
    );
  }

  return (
    <div ref={wrapRef}>
      <pre className={`${COLORS[frame % COLORS.length]} leading-tight whitespace-pre`}>
        {FRAMES[frame % FRAMES.length].replace(/^\n/, '')}
      </pre>
      <div className="t-dim">party parrot · Ctrl+C to stop the party</div>
    </div>
  );
}
