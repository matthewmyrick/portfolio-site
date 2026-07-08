import type { ReactNode } from 'react';

// Turn URLs and emails in a string into clickable links; everything else passes
// through untouched. Used for both file content and command output.
const LINK_RE = /(https?:\/\/[^\s)]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  let i = 0;
  while ((m = LINK_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    const href = token.includes('@') ? `mailto:${token}` : token;
    out.push(
      <a
        key={`lnk-${i++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="t-cyan underline underline-offset-2 hover:opacity-80"
      >
        {token}
      </a>
    );
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Like linkify, but also highlights "Y Combinator" / "YC" in orange.
const DECORATE_RE =
  /(https?:\/\/[^\s)]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(Y\sCombinator|\bYC\b)/g;

export function decorate(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  DECORATE_RE.lastIndex = 0;
  while ((m = DECORATE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const token = m[1];
      const href = token.includes('@') ? `mailto:${token}` : token;
      out.push(
        <a
          key={`lnk-${i++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="t-cyan underline underline-offset-2 hover:opacity-80"
        >
          {token}
        </a>
      );
    } else {
      out.push(
        <span key={`yc-${i++}`} className="t-orange font-semibold">
          {m[2]}
        </span>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Inline-styled rendering of a single markdown-ish line (no block wrapper).
function renderInline(line: string): ReactNode {
  if (line === '') return ' ';

  if (line.startsWith('# ')) {
    return <span className="t-accent font-bold">{line.slice(2)}</span>;
  }
  if (line.startsWith('## ')) {
    const rest = line.slice(3);
    const pipe = rest.indexOf(' | ');
    if (pipe !== -1) {
      return (
        <>
          <span className="t-cyan font-bold">{rest.slice(0, pipe)}</span>
          <span className="t-dim">{rest.slice(pipe)}</span>
        </>
      );
    }
    return <span className="t-cyan font-bold">{rest}</span>;
  }
  const kv = line.match(/^(\s*)([A-Za-z][\w .&/-]*):(\s*)(.*)$/);
  if (kv) {
    const [, indent, k, gap, v] = kv;
    return (
      <>
        {indent}
        <span className="t-cyan">{k}:</span>
        {gap}
        {decorate(v)}
      </>
    );
  }
  const bullet = line.match(/^(\s*)[-•]\s+(.*)$/);
  if (bullet) {
    return (
      <>
        {bullet[1]}
        <span className="t-accent">• </span>
        {decorate(bullet[2])}
      </>
    );
  }
  return <>{decorate(line)}</>;
}

// Render a markdown-ish string as styled terminal output (no frame/numbers).
// Headings get a little breathing room.
export function renderText(content: string): ReactNode {
  const lines = content.replace(/\n$/, '').split('\n');
  return (
    <div className="whitespace-pre-wrap">
      {lines.map((l, i) => (
        <div key={i} className={l.startsWith('#') ? 'mt-1' : ''}>
          {renderInline(l)}
        </div>
      ))}
    </div>
  );
}

const FRAME = 'rgb(var(--t-dim) / 0.35)';

// `bat`-style file view: header with the path, line-number gutter, syntax-ish
// highlighting, and a frame around it.
export function renderFile(content: string, path: string): ReactNode {
  const lines = content.replace(/\n$/, '').split('\n');
  return (
    <div
      className="my-1 max-w-3xl overflow-hidden rounded-md border"
      style={{ borderColor: FRAME }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1 text-xs"
        style={{ background: 'rgb(var(--t-fg) / 0.06)', borderBottom: `1px solid ${FRAME}` }}
      >
        <span className="t-dim">📄</span>
        <span className="t-cyan">{path}</span>
      </div>
      <div className="py-1">
        {lines.map((l, i) => (
          <div key={i} className="flex">
            <span
              className="t-dim shrink-0 px-3 text-right tabular-nums select-none"
              style={{ minWidth: '3.25rem' }}
            >
              {i + 1}
            </span>
            <span
              className="flex-1 pr-3 pl-3 break-words whitespace-pre-wrap"
              style={{ borderLeft: `1px solid ${FRAME}` }}
            >
              {renderInline(l)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Render preformatted, single-color text (ASCII art, neofetch logo).
export function Pre({ children, className = '' }: { children: string; className?: string }) {
  return <pre className={`font-mono leading-tight whitespace-pre ${className}`}>{children}</pre>;
}
