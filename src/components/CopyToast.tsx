import { useEffect, useRef, useState } from 'react';

// Terminal-style copy-on-select: highlighting text copies it to the clipboard
// and a small "copied" toast appears bottom-right, then fades.

export function CopyToast() {
  const [shown, setShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const lastCopied = useRef('');

  useEffect(() => {
    const onMouseUp = () => {
      // Let the selection settle before reading it.
      setTimeout(() => {
        const sel = window.getSelection()?.toString() ?? '';
        if (!sel.trim() || sel === lastCopied.current) return;
        navigator.clipboard
          ?.writeText(sel)
          .then(() => {
            lastCopied.current = sel;
            setShown(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setShown(false), 1500);
          })
          .catch(() => {
            /* clipboard permission denied — selection still works normally */
          });
      }, 0);
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!shown) return null;

  return (
    <div
      className="fixed right-3 bottom-3 z-50 rounded-md px-3 py-1.5 text-xs shadow-lg"
      style={{
        backgroundColor: 'rgb(var(--t-selection))',
        color: 'rgb(var(--t-fg))',
        border: '1px solid rgb(var(--t-dim) / 0.35)'
      }}
      role="status"
    >
      <span className="t-green">✓</span> copied to clipboard
    </div>
  );
}
