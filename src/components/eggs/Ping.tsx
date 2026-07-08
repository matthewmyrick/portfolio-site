import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { eggResult, setEggResult } from './cache';

// Fake `ping` with suspiciously excellent latency (the server is, after all,
// in the same apartment as the wallpaper). Runs until Ctrl+C (or a polite
// cap), then prints the classic stats block.

const MAX_REPLIES = 30;

interface Props {
  id: string;
  host: string;
  ip: string;
  local?: boolean; // localhost gets even more absurd numbers
}

export function Ping({ id, host, ip, local }: Props) {
  const prior = eggResult<number[]>(id);
  const [replies, setReplies] = useState<number[]>(prior ?? []); // rtt per reply, ms
  const [done, setDone] = useState(prior !== undefined);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prior) return; // finished on a previous mount — render the stats only
    let seq = 0;
    const rtts: number[] = [];
    const finish = () => {
      clearInterval(iv);
      setDone(true);
      setEggResult(id, rtts);
      const st = useStore.getState();
      if (st.job === 'ping') st.setJob(null);
    };
    const iv = setInterval(() => {
      if (useStore.getState().job !== 'ping') return finish();
      seq++;
      const rtt = local ? Math.random() * 0.008 : 0.02 + Math.random() * 0.07;
      rtts.push(rtt);
      setReplies([...rtts]);
      if (seq >= MAX_REPLIES) finish();
    }, 900);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wrapRef.current?.scrollIntoView({ block: 'nearest' });
  }, [replies, done]);

  const min = replies.length ? Math.min(...replies) : 0;
  const max = replies.length ? Math.max(...replies) : 0;
  const avg = replies.length ? replies.reduce((a, b) => a + b, 0) / replies.length : 0;
  const f = (n: number) => n.toFixed(3);

  return (
    <div ref={wrapRef} className="whitespace-pre-wrap">
      <div>
        PING {host} ({ip}) 56(84) bytes of data.
      </div>
      {replies.map((rtt, i) => (
        <div key={i}>
          64 bytes from {host} ({ip}): icmp_seq={i + 1} ttl={local ? 64 : 118} time=
          <span className="t-green">{f(rtt)} ms</span>
        </div>
      ))}
      {done && (
        <div className="mt-1">
          <div>^C</div>
          <div>--- {host} ping statistics ---</div>
          <div>
            {replies.length} packets transmitted, {replies.length} received,{' '}
            <span className="t-green">0% packet loss</span>, time {replies.length * 900}ms
          </div>
          <div>
            rtt min/avg/max/mdev = {f(min)}/{f(avg)}/{f(max)}/{f((max - min) / 4)} ms
          </div>
          {local && (
            <div className="t-dim mt-1">(of course it's fast — there's no place like it)</div>
          )}
          {!local && avg < 0.1 && (
            <div className="t-dim mt-1">
              (yes, sub-0.1ms to {host}. the routing here is immaculate.)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
