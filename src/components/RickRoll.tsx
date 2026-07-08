import { useEffect, useRef } from 'react';

// Shown by `cat .env`. Plays a snippet of /rickroll.mp3 (if present) — the
// triggering Enter keypress counts as a user gesture, so autoplay is allowed.
export function RickRoll() {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0.55;
    a.currentTime = 0;
    a.play().catch(() => {});
    const onTime = () => {
      if (a.currentTime > 25) a.pause(); // play ~25s, then stop
    };
    a.addEventListener('timeupdate', onTime);
    return () => {
      a.pause();
      a.removeEventListener('timeupdate', onTime);
    };
  }, []);

  return (
    <div>
      <div className="t-yellow">🎵 Never gonna give you up, never gonna let you down…</div>
      <img src="/rickroll.gif" alt="rickroll" className="mt-2 h-64 w-auto rounded" />
      {/* Drop static/rickroll.mp3 to add audio. */}
      <audio ref={audioRef} src="/rickroll.mp3" preload="auto" />
    </div>
  );
}
