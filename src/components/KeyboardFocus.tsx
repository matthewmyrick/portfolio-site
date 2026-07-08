import { useEffect, useRef } from 'react';

// Fullscreen apps (vim/less/htop) read keys from a window listener, with no
// real input focused. Browser extensions that add keyboard shortcuts (Vimium
// and friends) treat that as "browsing" and eat keys — digits especially.
// Keeping an invisible input focused makes them back off; our own capture
// listener still sees every key first.
//
// Those same extensions ALSO eat Escape (keydown *and* keyup) to "leave" the
// focused field — but they can't hide the side effect: our input blurs. A
// blur with no pointer activity and the page still focused can only be that
// stolen Escape, so we surface it via onEscapeIntent.
export function KeyboardFocus({ onEscapeIntent }: { onEscapeIntent?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const lastPointer = useRef(0);

  useEffect(() => {
    ref.current?.focus();
    const onPointer = () => {
      lastPointer.current = Date.now();
    };
    window.addEventListener('mousedown', onPointer, true);
    window.addEventListener('touchstart', onPointer, true);
    return () => {
      window.removeEventListener('mousedown', onPointer, true);
      window.removeEventListener('touchstart', onPointer, true);
    };
  }, []);

  const onBlur = () => {
    // No recent click/touch and the page still has focus → an extension
    // blurred us on purpose. That was the user's Escape.
    if (document.hasFocus() && Date.now() - lastPointer.current > 400) {
      onEscapeIntent?.();
    }
    setTimeout(() => ref.current?.focus(), 0);
  };

  return (
    <input
      ref={ref}
      value=""
      onChange={() => undefined}
      onBlur={onBlur}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      aria-hidden
      tabIndex={-1}
      className="pointer-events-none fixed top-0 left-0 h-px w-px opacity-0"
    />
  );
}
