// Tiny bit of shared shell state, in its own module so both the executor and
// the command registry can touch it without an import cycle.

const DEFAULT_ENV: [string, string][] = [
  ['HOME', '/home/visitor'],
  ['USER', 'visitor'],
  ['HOSTNAME', 'portfolio'],
  ['SHELL', '/bin/mmsh'],
  ['TERM', 'xterm-256color'],
  ['EDITOR', 'vim']
];

// `lastExit` follows the usual convention: 0 = success, 1 = generic error,
// 127 = command not found, 130 = interrupted (Ctrl+C). Any command that
// prints an error is considered failed.
export const shell = {
  lastExit: 0,
  // One-shot fortune override (the tour uses this to guarantee its punchline).
  nextFortune: null as string | null,
  aliases: new Map<string, string>(),
  env: new Map<string, string>(DEFAULT_ENV)
};

// Fresh shell for a new session (start / `source` / `term` switch).
// ~/.bashrc is re-applied on top by startSession().
export function resetShellSession(): void {
  shell.lastExit = 0;
  shell.aliases.clear();
  shell.env = new Map(DEFAULT_ENV);
}

// Apply one ~/.bashrc-style line: `alias name='value'` or `export K=V`.
// Comments, blanks, and anything else are ignored. Returns true if applied.
export function applyRcLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.startsWith('#')) return false;
  let m = t.match(/^alias\s+([A-Za-z_][\w-]*)=(?:'([^']*)'|"([^"]*)"|(\S+))\s*$/);
  if (m) {
    shell.aliases.set(m[1], m[2] ?? m[3] ?? m[4] ?? '');
    return true;
  }
  m = t.match(/^export\s+([A-Za-z_]\w*)=(?:'([^']*)'|"([^"]*)"|(\S*))\s*$/);
  if (m) {
    shell.env.set(m[1], m[2] ?? m[3] ?? m[4] ?? '');
    return true;
  }
  return false;
}
