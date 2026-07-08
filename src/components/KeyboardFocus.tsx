import { useEffect, useRef } from 'react';

// Fullscreen apps (vim/less/htop) read keys from a window listener, with no
// real input focused. Browser extensions that add keyboard shortcuts (Vimium
// and friends) treat that as "browsing" and eat keys — digits especially.
// Keeping an invisible input focused makes them back off; our own capture
// listener still sees every key first.
export function KeyboardFocus() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <input
      ref={ref}
      value=""
      onChange={() => undefined}
      onBlur={() => setTimeout(() => ref.current?.focus(), 0)}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      aria-hidden
      tabIndex={-1}
      className="pointer-events-none fixed top-0 left-0 h-px w-px opacity-0"
    />
  );
}
