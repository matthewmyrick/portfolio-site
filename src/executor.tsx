import type { ReactNode } from 'react';
import { useStore, type GameState } from './store';
import { COMMANDS } from './commands';
import { CommandEcho } from './components/Prompt';
import { getNode, resolvePath, HOME } from './lib/fsops';
import { openLess } from './components/Less';

const NO_GAME: GameState = { active: false, target: 0, attempts: 0, max: 7 };

const S = () => useStore.getState();
const print = (node: ReactNode) => S().print(node);
const printErr = (s: string) => print(<span className="t-red whitespace-pre-wrap">{s}</span>);

interface Parsed {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
  rest: string;
}

function parse(raw: string): Parsed {
  const trimmed = raw.trim();
  const tokens = trimmed.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? [];
  const command = (tokens[0] ?? '').toLowerCase();
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (const tok of tokens.slice(1)) {
    if (tok.startsWith('--')) {
      flags[tok.slice(2)] = true;
    } else if (tok.startsWith('-') && tok.length > 1) {
      for (const ch of tok.slice(1)) flags[ch] = true;
    } else {
      args.push(tok.replace(/^["']|["']$/g, ''));
    }
  }
  const sp = trimmed.indexOf(' ');
  const rest = sp === -1 ? '' : trimmed.slice(sp + 1);
  return { command, args, flags, rest };
}

// Split a line on top-level `|` (ignoring pipes inside quotes).
function splitPipes(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote = '';
  for (const ch of s) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === '|') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((p) => p.trim()).filter(Boolean);
}

function highlightMatches(line: string, re: RegExp): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  re.lastIndex = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(
      <span key={i++} className="t-string font-bold">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

// Run each segment's text() handler, feeding output to the next. Prints an
// error and returns null if a segment can't run.
function runPipelineText(
  initial: string | null,
  segments: string[]
): { out: string; last: Parsed | null } | null {
  let stdin = initial;
  let last: Parsed | null = null;
  for (const seg of segments) {
    const p = parse(seg);
    const cmd = COMMANDS[p.command];
    if (!cmd) {
      printErr(`command not found: ${p.command} — type 'help'`);
      return null;
    }
    if (!cmd.text) {
      printErr(`${p.command}: can't be used in a pipe`);
      return null;
    }
    stdin = cmd.text({ args: p.args, flags: p.flags, rest: p.rest }, stdin);
    last = p;
  }
  return { out: stdin ?? '', last };
}

function executePipeline(initial: string | null, segments: string[]): void {
  // `less` is a sink: when it ends the pipeline, page the output instead of
  // printing it. Anywhere else in a pipe it's an error (like a real pager).
  const names = segments.map((s) => parse(s).command);
  const pagerAt = names.findIndex((n) => n === 'less' || n === 'more');
  if (pagerAt !== -1 && pagerAt !== segments.length - 1) {
    return printErr(`${names[pagerAt]}: must be the last command in a pipeline`);
  }
  if (pagerAt !== -1) {
    const head = segments.slice(0, -1);
    let text = initial ?? '';
    if (head.length) {
      const r = runPipelineText(initial, head);
      if (r == null) return;
      text = r.out;
    }
    openLess(head.map((s) => s.trim()).join(' | ') || 'less', text);
    return;
  }

  const result = runPipelineText(initial, segments);
  if (result == null) return;
  const { out, last } = result;
  if (out === '') return print(<span className="t-dim">(no output)</span>);

  // If the final stage was grep, highlight the matched pattern (soft yellow).
  let re: RegExp | null = null;
  if (last && last.command === 'grep' && last.args[0]) {
    try {
      re = new RegExp(last.args[0], last.flags.i ? 'gi' : 'g');
    } catch {
      re = null;
    }
  }
  print(
    <div className="whitespace-pre-wrap">
      {out.split('\n').map((line, i) => (
        <div key={i}>{re ? highlightMatches(line, re) : line}</div>
      ))}
    </div>
  );
}

// `fzf` is interactive, so it can't run synchronously inside a pipe. Instead we
// open the finder and remember the rest of the pipeline; when the user picks a
// file, finishFzf() feeds the selected path into that remaining pipeline (or
// cats it when fzf was used standalone).
let pendingFzfTail: string[] = [];

function startFzf(tail: string[]): void {
  pendingFzfTail = tail;
  S().setOverlay('fzf');
}

export function finishFzf(path: string): void {
  const tail = pendingFzfTail;
  pendingFzfTail = [];
  if (tail.length === 0) {
    runCommand(`cat ${path}`); // standalone fzf → open the file
    return;
  }
  // piped fzf → feed the chosen file's contents into the rest of the pipeline,
  // so `fzf | grep foo` searches inside the file you picked.
  const node = getNode(resolvePath(HOME, path));
  const contents = node && node.type === 'file' ? node.content.replace(/\n$/, '') : '';
  executePipeline(contents, tail);
}

export function runCommand(raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  const st = S();

  // Echo the prompt + highlighted command into history (starts a new group).
  st.pushInput(<CommandEcho cwd={st.cwd} command={trimmed} />);
  st.pushHistory(trimmed);

  // While a game is running, all input goes to the game until quit.
  if (st.game.active) {
    processGameInput(trimmed);
    return;
  }

  const segments = splitPipes(trimmed);

  // fzf as a pipeline source (or standalone) — open the finder.
  if (parse(segments[0]).command === 'fzf') {
    startFzf(segments.slice(1));
    return;
  }

  // Pipes: `a | b | c` — run through each command's text() handler.
  if (segments.length > 1) {
    executePipeline(null, segments);
    return;
  }

  const { command, args, flags, rest } = parse(raw);
  const cmd = COMMANDS[command];
  if (!cmd) {
    printErr(`command not found: ${command} — type 'help'`);
    return;
  }
  cmd.run({ args, flags, rest });
}

function processGameInput(input: string): void {
  const g = S().game;
  const t = input.trim().toLowerCase();

  if (t === 'quit' || t === 'exit') {
    S().setGame(NO_GAME);
    print(
      <span className="t-yellow">Game ended. Thanks for playing! Type 'help' for commands.</span>
    );
    return;
  }
  if (t === 'hint') {
    const target = g.target;
    const hint =
      target <= 25
        ? 'quite low (1-25)'
        : target <= 50
          ? 'lower-middle (26-50)'
          : target <= 75
            ? 'upper-middle (51-75)'
            : 'quite high (76-100)';
    print(
      <span>
        <span className="t-cyan">Hint:</span> the number is {hint}
      </span>
    );
    return;
  }

  const guess = parseInt(t, 10);
  if (isNaN(guess) || guess < 1 || guess > 100) {
    printErr("Enter a number between 1 and 100, or 'quit' to exit.");
    return;
  }

  const attempts = g.attempts + 1;
  if (guess === g.target) {
    S().setGame(NO_GAME);
    print(
      <span className="t-green font-bold">
        🎉 Correct! {g.target} in {attempts} {attempts === 1 ? 'try' : 'tries'}. Type 'game' to play
        again.
      </span>
    );
    return;
  }
  if (attempts >= g.max) {
    S().setGame(NO_GAME);
    print(
      <span className="t-red">
        💥 Game over — the number was {g.target}. Type 'game' to play again.
      </span>
    );
    return;
  }
  S().setGame({ ...g, attempts });
  const remaining = g.max - attempts;
  print(
    <span className="t-yellow">
      {guess < g.target ? '📈 Too low!' : '📉 Too high!'} ({remaining} left)
    </span>
  );
}
