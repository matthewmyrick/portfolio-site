import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';

// The classic `sl` steam locomotive (mtoyoda/sl homage): typo `ls`, watch a
// train chug across the terminal. Runs as a foreground job — you can't type
// until it passes (that's the lesson), but Ctrl+C is allowed for mercy.

const ENGINE = String.raw`
      ====        ________                ___________
  _D _|  |_______/        \__I_I_____===__|_________|
   |(_)---  |   H\________/ |   |        =|___ ___|
   /     |  |   H  |  |     |   |         ||_| |_||
  |      |  |   H  |__--------------------| [___] |
  | ________|___H__/__|_____/[][]~\_______|       |
  |/ |   |-----------I_____I [][] []  D   |=======|__
__/ =| o |=-~~\  /~~\  /~~\  /~~\ ____Y___________|__
 |/-=|___|=    ||    ||    ||    |_____/~\___/
  \_/      \O=====O=====O=====O_/      \_/
`.replace(/^\n/, '');

const SPEED_PX = 14; // per frame
const FRAME_MS = 30;

export function SlTrain() {
  const [x, setX] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    wrapRef.current?.scrollIntoView({ block: 'nearest' });
    const width = wrapRef.current?.clientWidth ?? 800;
    let cur = width;
    setX(cur);
    const finish = () => {
      clearInterval(iv);
      setGone(true);
      const st = useStore.getState();
      if (st.job === 'sl') st.setJob(null);
    };
    const iv = setInterval(() => {
      // Cancelled from outside (Ctrl+C)?
      if (useStore.getState().job !== 'sl') return finish();
      cur -= SPEED_PX;
      if (cur < -900) return finish();
      setX(cur);
    }, FRAME_MS);
    return () => clearInterval(iv);
  }, []);

  if (gone || x === null) return null;

  return (
    <div ref={wrapRef} className="overflow-hidden">
      <pre
        className="t-fg leading-tight whitespace-pre"
        style={{ transform: `translateX(${x}px)`, willChange: 'transform' }}
      >
        {ENGINE}
      </pre>
    </div>
  );
}
