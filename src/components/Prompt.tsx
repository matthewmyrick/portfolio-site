import type { ReactNode } from 'react';
import { useStore } from '../store';
import { displayPath } from '../lib/fsops';
import { highlightClasses } from '../lib/highlight';
import { COMMAND_NAMES } from '../commands';
import { TERMINALS } from '../lib/terminals';

// Account icon (the p10k "user" glyph) as inline SVG so it renders everywhere —
// no Nerd Font required.
function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      style={{ display: 'inline-block', verticalAlign: '-0.15em' }}
      aria-hidden="true"
    >
      <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
    </svg>
  );
}

function PowerlinePrompt({ cwd, children }: { cwd: string; children: ReactNode }) {
  return (
    <div className="leading-snug">
      <div>
        <span className="t-dim">╭─ </span>
        <span className="t-accent font-bold">
          <UserIcon /> visitor
        </span>
        <span className="t-dim"> @ </span>
        <span className="t-blue font-bold">portfolio</span>
        <span className="t-dim"> • </span>
        <span className="t-yellow">{displayPath(cwd)}</span>
      </div>
      <div className="flex">
        <span className="t-dim shrink-0">╰─❯&nbsp;</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function ClassicPrompt({ cwd, children }: { cwd: string; children: ReactNode }) {
  return (
    <div className="flex items-center">
      <span className="t-green shrink-0 font-bold">visitor@portfolio</span>
      <span className="t-blue shrink-0">&nbsp;{displayPath(cwd)}</span>
      <span className="t-accent shrink-0">&nbsp;%&nbsp;</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function WarpPrompt({ cwd, children }: { cwd: string; children: ReactNode }) {
  return (
    <div className="flex items-center">
      <span className="t-accent shrink-0">
        <UserIcon />
      </span>
      <span className="t-fg shrink-0">&nbsp;visitor</span>
      <span className="t-dim shrink-0">&nbsp;{displayPath(cwd)}&nbsp;</span>
      <span className="t-accent shrink-0 font-bold">❯&nbsp;</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// Prompt switches style based on the active terminal.
export function Prompt({ cwd, children }: { cwd: string; children: ReactNode }) {
  const term = useStore((s) => s.term);
  const style = TERMINALS[term].prompt;
  if (style === 'classic') return <ClassicPrompt cwd={cwd}>{children}</ClassicPrompt>;
  if (style === 'warp') return <WarpPrompt cwd={cwd}>{children}</WarpPrompt>;
  return <PowerlinePrompt cwd={cwd}>{children}</PowerlinePrompt>;
}

// Render text with per-character highlight classes grouped into spans.
export function HighlightedText({ text, cwd }: { text: string; cwd: string }) {
  const classes = highlightClasses(text, COMMAND_NAMES, cwd);
  const runs: { cls: string; text: string }[] = [];
  for (let i = 0; i < text.length; i++) {
    const cls = classes[i] ?? '';
    const last = runs[runs.length - 1];
    if (last && last.cls === cls) last.text += text[i];
    else runs.push({ cls, text: text[i] });
  }
  return (
    <span className="break-words whitespace-pre-wrap">
      {runs.map((r, i) => (
        <span key={i} className={r.cls}>
          {r.text}
        </span>
      ))}
    </span>
  );
}

// A past command line: prompt + highlighted (static) command.
export function CommandEcho({ cwd, command }: { cwd: string; command: string }) {
  return (
    <Prompt cwd={cwd}>
      <HighlightedText text={command} cwd={cwd} />
    </Prompt>
  );
}
