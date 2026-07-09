import type { ReactNode } from 'react';
import { useStore } from './store';
import { renderText, renderFile } from './lib/render';
import {
  resolvePath,
  getNode,
  displayPath,
  listDir,
  walkFiles,
  isDir,
  basename,
  setActiveRoot,
  HOME
} from './lib/fsops';
import { ROOT, GUEST_ROOT } from './lib/filesystem';
import { THEMES, isThemeName } from './lib/themes';
import { TERMINALS, isTermType } from './lib/terminals';
import { RickRoll } from './components/RickRoll';
import { openVim } from './components/Vim';
import { startSu } from './executor';
import { openLess } from './components/Less';
import { SlTrain } from './components/eggs/SlTrain';
import { PacmanInstall } from './components/eggs/Pacman';
import { Ping } from './components/eggs/Ping';
import { Parrot } from './components/eggs/Parrot';
import { RmRf } from './components/eggs/RmRf';
import { eggId } from './components/eggs/cache';
import { shell, resetShellSession, applyRcLine } from './lib/shell';
import {
  cluster,
  resetCluster,
  touchCluster,
  phase as clusterPhase,
  setMemLimit,
  respawnCrashPod,
  crashPodName,
  mttr,
  pods,
  crashLogs,
  describeCrashPod,
  parseManifestLimit,
  deployManifest,
  describeDeployment
} from './lib/cluster';

export interface Ctx {
  args: string[]; // positional args (quotes stripped)
  flags: Record<string, string | boolean>;
  rest: string; // raw text after the command name
}

export interface Command {
  desc: string;
  usage?: string;
  group: 'Filesystem' | 'Customize' | 'Session' | 'Matthew';
  hidden?: boolean;
  run: (ctx: Ctx) => void;
  // Plain-text output for pipes (`a | b`). `stdin` is the previous stage's
  // output, or null when this command is first in the pipeline.
  text?: (ctx: Ctx, stdin: string | null) => string;
  // Extra man-page content: long DESCRIPTION text and EXAMPLES / SEE ALSO.
  // Every command gets a generated page from desc/usage; this enriches it.
  man?: { description?: string; examples?: string[]; seeAlso?: string[] };
}

const APP_START = Date.now();

const S = () => useStore.getState();
const print = (node: ReactNode) => S().print(node);
const printText = (s: string) => print(renderText(s));
const printErr = (s: string) => {
  shell.lastExit ||= 1; // an error line means the command failed
  print(<span className="t-red whitespace-pre-wrap">{s}</span>);
};

function catFile(rel: string): void {
  const abs = resolvePath(HOME, rel);
  const node = getNode(abs);
  if (node && node.type === 'file') print(renderFile(node.content, displayPath(abs)));
}

// ---- ls ------------------------------------------------------------------
function entrySpan(name: string, dir: boolean, key: number): ReactNode {
  return (
    <span key={key} className={dir ? 't-blue font-bold' : 't-fg'}>
      {name}
      {dir ? '/' : ''}
    </span>
  );
}

function lsPath(
  absPath: string,
  opts: { long: boolean; recursive: boolean; all: boolean }
): ReactNode {
  const node = getNode(absPath);
  if (!node) {
    return <span className="t-red">ls: {displayPath(absPath)}: No such file or directory</span>;
  }
  if (node.type === 'file') {
    return <span>{displayPath(absPath)}</span>;
  }
  if (opts.recursive) {
    const sections: ReactNode[] = [];
    const visit = (p: string) => {
      const n = getNode(p);
      if (!n || n.type !== 'dir') return;
      const entries = listDir(n, opts.all);
      sections.push(
        <div key={p} className="mb-1">
          <span className="t-dim">{displayPath(p)}:</span>
          <div className="flex flex-wrap gap-x-4">
            {entries.map((e, i) => entrySpan(e.name, e.isDir, i))}
          </div>
        </div>
      );
      entries.filter((e) => e.isDir).forEach((e) => visit(p + '/' + e.name));
    };
    visit(absPath);
    return <div>{sections}</div>;
  }
  const entries = listDir(node, opts.all);
  if (opts.long) {
    return (
      <div>
        {entries.map((e, i) => (
          <div key={i}>
            <span className="t-dim">{e.isDir ? 'd' : '-'}rw-r--r-- </span>
            {entrySpan(e.name, e.isDir, i)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-4">
      {entries.map((e, i) => entrySpan(e.name, e.isDir, i))}
    </div>
  );
}

// ---- grep ----------------------------------------------------------------
function grepLine(line: string, re: RegExp): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  let i = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(
      <span key={i++} className="t-yellow font-bold">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++; // guard against zero-width
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

// ---- neofetch ------------------------------------------------------------
function uptime(): string {
  const secs = Math.floor((Date.now() - APP_START) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  return `${m}m ${secs % 60}s`;
}

function neofetch(): ReactNode {
  const { theme, term, host } = S();
  const guest = host !== 'portfolio';
  const info: [string, string][] = [
    ['OS', guest ? 'Raspberry Pi OS (closet)' : 'Arch Linux (home lab)'],
    ['Host', guest ? 'A closet · NYC' : 'Apartment · NYC'],
    ['Kernel', 'react-vite-2.0.0'],
    ['Uptime', uptime()],
    ['Shell', 'mmsh 1.0'],
    ['Theme', THEMES[theme].label],
    ['Terminal', TERMINALS[term].label],
    ['CPU', 'Caffeine (8) @ 3.0GHz'],
    ['Memory', '640K / ought to be enough']
  ];
  return (
    <div>
      <div>
        <span className="t-accent font-bold">visitor</span>
        <span className="t-dim">@</span>
        <span className="t-accent font-bold">{host}</span>
      </div>
      <div className="t-dim">-----------------</div>
      {info.map(([k, v]) => (
        <div key={k}>
          <span className="t-accent font-bold">{k}</span>
          <span className="t-dim">: </span>
          {v}
        </div>
      ))}
    </div>
  );
}

const GAME_INTRO = `# Number Guessing Game

I'm thinking of a number between 1 and 100.
- Type a number (1-100) to guess
- Type 'hint' for a clue
- Type 'quit' to leave

Good luck!`;

// `cat .env` easter egg — never gonna give you up.
function rickroll(): ReactNode {
  return <RickRoll />;
}

// `cat cat` — the README warned you about him (he finds power buttons).
// ASCII stand-in until a real photo lands in static/ (then: <img src="/cat.jpg">).
const THE_CAT = [
  '      /\\_/\\',
  '     ( o.o )   *finds your power button*',
  '      > ^ <',
  '     /|   |\\',
  '    (_|   |_)'
].join('\n');

function catTheCat(): ReactNode {
  return (
    <div>
      <pre className="t-yellow leading-tight whitespace-pre">{THE_CAT}</pre>
      <div className="t-dim mt-1">
        cat: cat: is a cat. (Real photo pending — he's camera-shy. If the site goes down, he found
        the power button again.)
      </div>
    </div>
  );
}

// sudo attempts this session (module-level: survives `clear` and `source`).
let sudoAttempts = 0;

// ---- fortune + cowsay ------------------------------------------------------
const FORTUNES = [
  'There is no place like 127.0.0.1.',
  "It's not DNS. There's no way it's DNS. It was DNS.",
  'A SRE walks into a bar. The bar has 99.95% uptime.',
  'The S in IoT stands for Security.',
  'Real engineers test in production. Great ones have a rollback plan.',
  'You either die a startup or live long enough to run Kubernetes.',
  "The cloud is just someone else's computer. This site is just my computer.",
  'Weeks of coding can save you hours of planning.',
  "A backup you haven't restored is a rumor.",
  'chmod 777 is not a personality.',
  'If it hurts, do it more often. — someone who never carried a pager',
  'Postmortems: where "human error" goes to be renamed "missing guardrail".',
  'Latency is zero when you self-host in your living room.',
  "YAML: it's only whitespace-sensitive when you're in a hurry.",
  "Nine women can't deploy a baby in one month.",
  'The best alert is the one that never fires. The second best fires once.',
  "Everything is a file. Especially the things that aren't.",
  "Never trust a computer you can't throw out a window. — Steve Wozniak",
  'sudo make me a sandwich.',
  'There are two hard problems: cache invalidation, naming, and off-by-one errors.'
];

// Word-wrap a message and put a cow under it, cowsay(1)-style.
function cowsayText(msg: string): string {
  const words = (msg.trim() || 'moo?').split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > 40) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  lines.push(cur);
  const width = Math.max(...lines.map((l) => l.length));
  const pad = (l: string) => l + ' '.repeat(width - l.length);
  const bubble =
    lines.length === 1
      ? [`< ${lines[0]} >`]
      : lines.map((l, i) => {
          const [open, close] =
            i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|'];
          return `${open} ${pad(l)} ${close}`;
        });
  return [
    ' ' + '_'.repeat(width + 2),
    ...bubble,
    ' ' + '-'.repeat(width + 2),
    '        \\   ^__^',
    '         \\  (oo)\\_______',
    '            (__)\\       )\\/\\',
    '                ||----w |',
    '                ||     ||'
  ].join('\n');
}

// ---- pipe helpers (head / tail / wc) ----
function headTail(which: 'head' | 'tail') {
  return (ctx: Ctx, stdin: string | null): string => {
    const numeric = ctx.args.find((a) => /^\d+$/.test(a));
    const n = numeric ? parseInt(numeric, 10) : 10;
    const file = ctx.args.find((a) => !/^\d+$/.test(a));
    let text = stdin;
    if (text == null) {
      const node = file ? getNode(resolvePath(S().cwd, file)) : null;
      text = node && node.type === 'file' ? node.content : '';
    }
    const lines = text.replace(/\n$/, '').split('\n');
    return (which === 'head' ? lines.slice(0, n) : lines.slice(-n)).join('\n');
  };
}

function wcText(ctx: Ctx, stdin: string | null): string {
  let text = stdin;
  if (text == null) {
    const file = ctx.args[0];
    const node = file ? getNode(resolvePath(S().cwd, file)) : null;
    text = node && node.type === 'file' ? node.content : '';
  }
  const trimmed = text.replace(/\n$/, '');
  const lines = trimmed === '' ? 0 : trimmed.split('\n').length;
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  return `${lines} ${words} ${text.length}`;
}

// ---- small coreutils (sort / uniq / rev / tr / sed) -------------------------

// Input lines for a text utility: stdin if piped, else the file at args[i].
function utilLines(ctx: Ctx, stdin: string | null, fileArg = 0): string[] | null {
  let text = stdin;
  if (text == null) {
    const file = ctx.args[fileArg];
    if (!file) return null;
    const node = getNode(resolvePath(S().cwd, file));
    if (!node || node.type !== 'file') return null;
    text = node.content;
  }
  return text.replace(/\n$/, '').split('\n');
}

function sortText(ctx: Ctx, stdin: string | null): string {
  const lines = utilLines(ctx, stdin) ?? [];
  let out = [...lines];
  if (ctx.flags.n) out.sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
  else out.sort((a, b) => a.localeCompare(b));
  if (ctx.flags.r) out.reverse();
  if (ctx.flags.u) out = out.filter((l, i) => i === 0 || l !== out[i - 1]);
  return out.join('\n');
}

function uniqText(ctx: Ctx, stdin: string | null): string {
  const lines = utilLines(ctx, stdin) ?? [];
  const out: string[] = [];
  let prev: string | null = null;
  let count = 0;
  const flush = () => {
    if (prev !== null) {
      out.push(ctx.flags.c ? `${String(count).padStart(7)} ${prev}` : prev);
    }
  };
  for (const l of lines) {
    if (l === prev) count++;
    else {
      flush();
      prev = l;
      count = 1;
    }
  }
  flush();
  return out.join('\n');
}

const revText = (ctx: Ctx, stdin: string | null): string =>
  (utilLines(ctx, stdin) ?? []).map((l) => [...l].reverse().join('')).join('\n');

// Expand tr-style ranges: "a-z0-9" → "abc…z012…9".
function trExpand(spec: string): string {
  let out = '';
  for (let i = 0; i < spec.length; i++) {
    if (spec[i + 1] === '-' && i + 2 < spec.length) {
      const from = spec.charCodeAt(i);
      const to = spec.charCodeAt(i + 2);
      for (let c = from; c <= to; c++) out += String.fromCharCode(c);
      i += 2;
    } else {
      out += spec[i];
    }
  }
  return out;
}

function trText(ctx: Ctx, stdin: string | null): string {
  const [fromSpec, toSpec] = ctx.args;
  if (!fromSpec || !toSpec) return '';
  const from = trExpand(fromSpec);
  const to = trExpand(toSpec);
  const map = new Map<string, string>();
  for (let i = 0; i < from.length; i++) {
    map.set(from[i], to[Math.min(i, to.length - 1)] ?? '');
  }
  const text = stdin ?? '';
  return [...text.replace(/\n$/, '')].map((ch) => map.get(ch) ?? ch).join('');
}

// sed 's/foo/bar/[g]' — any delimiter, basic regex substitute.
function sedText(ctx: Ctx, stdin: string | null): string {
  const expr = ctx.args[0] ?? '';
  const m = expr.match(/^s(.)((?:\\.|[^\\])*?)\1((?:\\.|[^\\])*?)\1(g?)$/);
  if (!m) return '';
  let re: RegExp;
  try {
    re = new RegExp(m[2], m[4] ? 'g' : '');
  } catch {
    return '';
  }
  const lines = utilLines(ctx, stdin, 1) ?? [];
  return lines.map((l) => l.replace(re, m[3])).join('\n');
}

// Standalone runner for a text util: print its text() output (or usage).
function utilRun(fn: (ctx: Ctx, stdin: string | null) => string, usage: string) {
  return (ctx: Ctx) => {
    const out = fn(ctx, null);
    if (out === '') return printErr(`usage: ${usage}`);
    print(<div className="whitespace-pre-wrap">{out}</div>);
  };
}

// ---- vim -------------------------------------------------------------------
const vimCommand: Command = {
  desc: 'Edit a file (modal editor — good luck exiting)',
  usage: 'vim [file]',
  group: 'Filesystem',
  man: {
    description:
      'A modal editor in the spirit of vim. NORMAL mode: h/j/k/l to move, ' +
      'w/b word motions, 0/$ line ends, gg/G file ends, x delete char, ' +
      'dd delete line, yy yank, p paste, o/O open line, i/a/A/I insert, ' +
      'u undo, and count prefixes (5j, 2dd, 10G). :w writes to the session ' +
      'filesystem (cat and grep see your edits), :q quits, :q! quits ' +
      'without saving, :wq does both, :<n> jumps to a line. Site content ' +
      'opens [RO] — browse it, but no touching. Your own files (.bashrc, ' +
      'new ones) are editable, until you reload the page.',
    examples: ['vim about.md', 'vim notes.md   (new file — :w creates it)', 'vim'],
    seeAlso: ['less', 'cat']
  },
  run: ({ args }) => {
    if (!args.length) {
      // The most famous thing about vim is not knowing how to leave it.
      return openVim({ path: null, lines: ['now try to exit.'], newFile: false });
    }
    const abs = resolvePath(S().cwd, args[0]);
    const node = getNode(abs);
    if (node && node.type === 'dir') return printErr(`vim: ${args[0]}: Is a directory`);
    if (node) {
      return openVim({
        path: abs,
        lines: node.content.replace(/\n$/, '').split('\n'),
        newFile: false,
        readonly: !!node.readonly // site content: browse yes, edit no
      });
    }
    // New file — its parent directory must exist; created for real on :w.
    const parent = getNode(abs.slice(0, abs.lastIndexOf('/')) || '/');
    if (!parent || parent.type !== 'dir') {
      return printErr(`vim: ${args[0]}: No such file or directory`);
    }
    openVim({ path: abs, lines: [''], newFile: true });
  }
};

// ---- less ------------------------------------------------------------------
const lessCommand: Command = {
  desc: 'Page through a file (j/k scroll, / search, q quit)',
  usage: 'less <file>',
  group: 'Filesystem',
  man: {
    description:
      'A pager. j/k or arrows scroll by line, Space/b by page, d/u by ' +
      'half page, g/G jump to the top/bottom. /pattern searches (n/N for ' +
      'next/previous match, highlighted). q quits. Also works as a ' +
      "pipeline sink: any command's output can be paged.",
    examples: ['less resume.md', 'cat about.md | less', 'man ls   (opens here)'],
    seeAlso: ['cat', 'man', 'vim']
  },
  run: ({ args }) => {
    if (!args.length) return printErr('usage: less <file>  (or: cat file.md | less)');
    const abs = resolvePath(S().cwd, args[0]);
    const node = getNode(abs);
    if (!node) return printErr(`less: ${args[0]}: No such file or directory`);
    if (node.type === 'dir') return printErr(`less: ${args[0]}: Is a directory`);
    openLess(displayPath(abs), node.content);
  }
};

// ---- man -------------------------------------------------------------------
function wrapText(text: string, indent: string, width = 72): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (line && (line + ' ' + word).length > width) {
        out.push(indent + line);
        line = word;
      } else {
        line = line ? line + ' ' + word : word;
      }
    }
    out.push(indent + line);
  }
  return out;
}

// Render a classic man(1) page for a command. Every command gets one,
// generated from desc/usage and enriched by its optional `man` field.
function manPage(name: string, cmd: Command): string {
  const tag = `${name.toUpperCase()}(1)`;
  const title = 'Portfolio Manual';
  const width = 78;
  const gap = Math.max(1, Math.floor((width - 2 * tag.length - title.length) / 2));
  const header =
    tag +
    ' '.repeat(gap) +
    title +
    ' '.repeat(Math.max(1, width - 2 * tag.length - title.length - gap)) +
    tag;

  const ind = '       ';
  const lines: string[] = [header, ''];
  lines.push('NAME', `${ind}${name} - ${cmd.desc}`, '');
  lines.push('SYNOPSIS', `${ind}${cmd.usage ?? name}`, '');
  lines.push('DESCRIPTION', ...wrapText(cmd.man?.description ?? cmd.desc, ind), '');
  if (cmd.man?.examples?.length) {
    lines.push('EXAMPLES');
    for (const ex of cmd.man.examples) lines.push(`${ind}${ex}`);
    lines.push('');
  }
  if (cmd.man?.seeAlso?.length) {
    lines.push('SEE ALSO', `${ind}${cmd.man.seeAlso.map((s) => `${s}(1)`).join(', ')}`, '');
  }
  lines.push(`mmsh 1.0${' '.repeat(Math.max(1, width - 8 - tag.length))}${tag}`);
  return lines.join('\n');
}

// ---- kubectl (the incident) -------------------------------------------------
function podTable(): ReactNode {
  const rows = pods();
  const pad = (s: string, n: number) => s.padEnd(n);
  return (
    <div className="leading-relaxed whitespace-pre">
      <div className="t-dim">
        {pad('NAME', 34) + pad('READY', 8) + pad('STATUS', 20) + pad('RESTARTS', 11) + 'AGE'}
      </div>
      {rows.map((p) => (
        <div key={p.name}>
          {pad(p.name, 34)}
          {pad(p.ready, 8)}
          <span
            className={
              p.status === 'Running'
                ? 't-green'
                : p.status === 'CrashLoopBackOff'
                  ? 't-red font-bold'
                  : 't-yellow'
            }
          >
            {pad(p.status, 20)}
          </span>
          <span className={p.restarts > 3 ? 't-red' : 't-fg'}>{pad(String(p.restarts), 11)}</span>
          {p.age}
        </div>
      ))}
    </div>
  );
}

// After any kubectl command, celebrate the first time the cluster is healthy.
function maybeCelebrate(): void {
  if (clusterPhase() === 'healthy' && !cluster.celebrated) {
    cluster.celebrated = true;
    print(
      <div className="mt-1">
        <span className="t-green font-bold">🎉 incident resolved</span>
        <span className="t-dim"> — MTTR: </span>
        <span className="t-yellow font-bold">{mttr()}</span>
        <span className="t-dim"> · portfolio-web is healthy again. go write the postmortem.</span>
      </div>
    );
  }
}

function applyLimitFix(mi: number, via: string): void {
  const result = setMemLimit(mi);
  if (result === 'fixed') {
    print(<span>deployment.apps/portfolio-web {via}</span>);
    print(
      <span className="t-dim">
        (new pods rolling out — try{' '}
        <span className="t-green">kubectl rollout status deployment/portfolio-web</span>, then{' '}
        <span className="t-green">kubectl get pods</span>)
      </span>
    );
  } else {
    print(<span>deployment.apps/portfolio-web {via}</span>);
    printErr(`warning: ${mi}Mi is still not enough memory. the pod respectfully continues to die.`);
  }
}

const KUBECTL_USAGE = [
  'kubectl controls the (this) Kubernetes cluster.',
  '',
  '  kubectl get pods                  list pods (something looks wrong)',
  '  kubectl get deployments           list deployments',
  '  kubectl get events                recent cluster events',
  '  kubectl logs <pod>                container logs',
  '  kubectl describe pod <pod>        everything about a pod',
  '  kubectl describe deployment portfolio-web   current limits + conditions',
  '  kubectl get deployment portfolio-web -o yaml',
  '  kubectl delete pod <pod>          (see what happens)',
  '  kubectl edit deployment portfolio-web',
  '  kubectl set resources deployment portfolio-web --limits=memory=256Mi',
  '  kubectl rollout status|restart deployment/portfolio-web'
].join('\n');

// ---- registry ------------------------------------------------------------
export const COMMANDS: Record<string, Command> = {
  help: {
    desc: 'Show this help message (-a for everything)',
    usage: 'help [-a|--all]',
    group: 'Session',
    man: {
      description:
        'Lists the available commands by group. With -a (or --all), also ' +
        'reveals the hidden commands and easter eggs. Spoilers, basically.',
      examples: ['help', 'help -a'],
      seeAlso: ['man', 'about']
    },
    run: ({ flags }) => print(helpOutput(!!flags.a || !!flags.all))
  },

  pwd: {
    desc: 'Print the current directory',
    group: 'Filesystem',
    run: () => print(<span>{S().cwd}</span>),
    text: () => S().cwd
  },

  ls: {
    desc: 'List directory contents',
    usage: 'ls [-l] [-a] [-R] [path]',
    group: 'Filesystem',
    man: {
      description:
        'Lists the contents of a directory (the current one by default). ' +
        '-l uses a long listing, -a includes hidden dotfiles (there may be ' +
        'something interesting in there), and -R recurses into ' +
        'subdirectories. Directories are shown in bold with a trailing /.',
      examples: ['ls', 'ls -la', 'ls -R ~', 'ls projects/'],
      seeAlso: ['cd', 'find', 'fzf']
    },
    run: ({ args, flags }) => {
      const long = !!flags.l;
      const recursive = !!flags.R;
      const all = !!flags.a;
      const targets = args.length ? args : ['.'];
      targets.forEach((t) => print(lsPath(resolvePath(S().cwd, t), { long, recursive, all })));
    },
    text: ({ args, flags }) => {
      const node = getNode(resolvePath(S().cwd, args[0] ?? '.'));
      if (!node) return '';
      if (node.type === 'file') return displayPath(resolvePath(S().cwd, args[0] ?? '.'));
      return listDir(node, !!flags.a)
        .map((e) => e.name + (e.isDir ? '/' : ''))
        .join('\n');
    }
  },

  cd: {
    desc: 'Change directory',
    usage: 'cd [path]',
    group: 'Filesystem',
    run: ({ args }) => {
      const target = resolvePath(S().cwd, args[0] ?? '~');
      const node = getNode(target);
      if (!node) return printErr(`cd: ${args[0]}: No such file or directory`);
      if (!isDir(node)) return printErr(`cd: ${args[0]}: Not a directory`);
      S().setCwd(target);
    }
  },

  cat: {
    desc: 'Print file contents',
    usage: 'cat <file>...',
    group: 'Filesystem',
    man: {
      description:
        'Prints a file with a bat-style frame: header, line-number gutter, ' +
        'and light markdown coloring. In a pipeline it emits plain text ' +
        '(cat resume.md | grep -i kubernetes). Some files are not what ' +
        'they seem.',
      examples: ['cat about.md', 'cat resume.md | grep -i go', 'cat experience/hadrius-ai.md'],
      seeAlso: ['less', 'head', 'tail', 'grep']
    },
    run: ({ args }) => {
      if (!args.length) return printErr('cat: missing file operand');
      args.forEach((a) => {
        const abs = resolvePath(S().cwd, a);
        const node = getNode(abs);
        // `cat cat` — there is no file named cat, but there is a cat.
        if (!node && a.toLowerCase() === 'cat') return print(catTheCat());
        if (!node) return printErr(`cat: ${a}: No such file or directory`);
        if (node.type === 'dir') return printErr(`cat: ${a}: Is a directory`);
        if (basename(abs) === '.env') return print(rickroll()); // gotcha
        if (basename(abs).endsWith('.pdf')) {
          return print(
            <span>
              cat: {a}: binary file — run <span className="t-green">open {a}</span> to view it
            </span>
          );
        }
        print(renderFile(node.content, displayPath(abs)));
      });
    },
    text: ({ args }, stdin) => {
      if (!args.length) return stdin ?? '';
      return args
        .map((a) => {
          const node = getNode(resolvePath(S().cwd, a));
          return node && node.type === 'file' ? node.content.replace(/\n$/, '') : '';
        })
        .join('\n');
    }
  },

  grep: {
    desc: 'Search file contents for a pattern',
    usage: 'grep [-i] <pattern> [path]',
    group: 'Filesystem',
    man: {
      description:
        'Searches for a regular-expression pattern. Standalone it walks ' +
        'every file under [path] (default: the current directory) and ' +
        'prints file:line matches. In a pipeline it filters stdin lines. ' +
        '-i makes the match case-insensitive. Matches are highlighted.',
      examples: ['grep -i kubernetes', 'cat resume.md | grep -i sre', 'ls | grep md'],
      seeAlso: ['find', 'cat', 'fzf']
    },
    run: ({ args, flags }) => {
      if (!args.length) return printErr('usage: grep [-i] <pattern> [path]');
      const pattern = args[0];
      const where = resolvePath(S().cwd, args[1] ?? '.');
      let re: RegExp;
      try {
        re = new RegExp(pattern, flags.i ? 'gi' : 'g');
      } catch {
        return printErr(`grep: invalid pattern: ${pattern}`);
      }
      const files = walkFiles(where);
      let hits = 0;
      files.forEach((f) => {
        f.content.split('\n').forEach((line, idx) => {
          re.lastIndex = 0;
          if (re.test(line)) {
            hits++;
            print(
              <div className="whitespace-pre-wrap">
                <span className="t-magenta">{displayPath(f.path)}</span>
                <span className="t-dim">:{idx + 1}: </span>
                {grepLine(line, re)}
              </div>
            );
          }
        });
      });
      if (!hits) printErr(`grep: no matches for "${pattern}"`);
    },
    // In a pipe: filter stdin lines; otherwise search files under [path].
    text: ({ args, flags }, stdin) => {
      const pattern = args[0];
      if (!pattern) return '';
      let re: RegExp;
      try {
        re = new RegExp(pattern, flags.i ? 'i' : '');
      } catch {
        return '';
      }
      if (stdin != null) {
        return stdin
          .split('\n')
          .filter((l) => re.test(l))
          .join('\n');
      }
      const where = resolvePath(S().cwd, args[1] ?? '.');
      const out: string[] = [];
      walkFiles(where).forEach((f) => {
        f.content.split('\n').forEach((line, idx) => {
          if (re.test(line)) out.push(`${displayPath(f.path)}:${idx + 1}:${line}`);
        });
      });
      return out.join('\n');
    }
  },

  find: {
    desc: 'List files under a directory',
    usage: 'find [path]',
    group: 'Filesystem',
    run: ({ args }) => {
      const where = resolvePath(S().cwd, args[0] ?? '.');
      const node = getNode(where);
      if (!node) return printErr(`find: ${args[0]}: No such file or directory`);
      const files = walkFiles(where);
      print(
        <div className="whitespace-pre-wrap">
          {files.map((f) => (
            <div key={f.path}>{displayPath(f.path)}</div>
          ))}
        </div>
      );
    },
    text: ({ args }) =>
      walkFiles(resolvePath(S().cwd, args[0] ?? '.'))
        .map((f) => displayPath(f.path))
        .join('\n')
  },

  head: {
    desc: 'First N lines (default 10)',
    usage: 'head [n] [file]',
    group: 'Filesystem',
    run: (ctx) => print(<div className="whitespace-pre-wrap">{headTail('head')(ctx, null)}</div>),
    text: headTail('head')
  },

  tail: {
    desc: 'Last N lines (default 10)',
    usage: 'tail [n] [file]',
    group: 'Filesystem',
    run: (ctx) => print(<div className="whitespace-pre-wrap">{headTail('tail')(ctx, null)}</div>),
    text: headTail('tail')
  },

  wc: {
    desc: 'Count lines, words, characters',
    usage: 'wc [file]',
    group: 'Filesystem',
    run: (ctx) => print(<div className="whitespace-pre-wrap">{wcText(ctx, null)}</div>),
    text: wcText
  },

  sort: {
    desc: 'Sort lines (-r reverse, -n numeric, -u unique)',
    usage: 'sort [-rnu] [file]',
    group: 'Filesystem',
    man: {
      description:
        'Sorts input lines. -r reverses, -n compares numerically, -u drops ' +
        'adjacent duplicates after sorting. Shines in pipelines.',
      examples: ['ls | sort -r', 'history | sort | uniq -c | sort -rn | head 5'],
      seeAlso: ['uniq', 'head', 'tail']
    },
    run: utilRun(sortText, 'sort [-rnu] <file>  (or: ls | sort)'),
    text: sortText
  },

  uniq: {
    desc: 'Filter adjacent duplicate lines (-c counts)',
    usage: 'uniq [-c] [file]',
    group: 'Filesystem',
    man: {
      description:
        'Collapses ADJACENT duplicate lines (sort first, like your ' +
        'ancestors did). -c prefixes each line with its count.',
      examples: ['history | sort | uniq -c | sort -rn', 'sort skills.md | uniq'],
      seeAlso: ['sort', 'wc']
    },
    run: utilRun(uniqText, 'uniq [-c] <file>  (or: ... | uniq)'),
    text: uniqText
  },

  rev: {
    desc: 'Reverse each line character-wise',
    usage: 'rev [file]',
    group: 'Filesystem',
    hidden: true,
    run: utilRun(revText, 'rev <file>  (or: echo hello | rev)'),
    text: revText
  },

  tr: {
    desc: 'Translate characters (ranges supported)',
    usage: 'tr <from> <to>',
    group: 'Filesystem',
    hidden: true,
    man: {
      description:
        'Translates characters from one set to another, with a-z style ' +
        'ranges. Pipe-only, like the real thing.',
      examples: ['echo hello | tr a-z A-Z', 'cat about.md | tr aeiou _'],
      seeAlso: ['sed', 'rev']
    },
    run: () => printErr('usage: echo text | tr a-z A-Z  (tr reads from a pipe)'),
    text: trText
  },

  sed: {
    desc: 'Stream editor (s/find/replace/ only)',
    usage: "sed 's/foo/bar/[g]' [file]",
    group: 'Filesystem',
    man: {
      description:
        'The one sed command everyone actually uses: s///, with any ' +
        'delimiter, regex patterns, and the g flag. Works on a file or ' +
        'in a pipeline.',
      examples: ["sed 's/Kubernetes/k8s/g' resume.md", "fortune | sed 's/^/> /'"],
      seeAlso: ['tr', 'grep']
    },
    run: utilRun(sedText, "sed 's/foo/bar/g' <file>"),
    text: sedText
  },

  fzf: {
    desc: 'Fuzzy-find a file (interactive)',
    usage: 'fzf [| command]',
    group: 'Filesystem',
    man: {
      description:
        'Opens an interactive fuzzy finder over every file in the ' +
        'filesystem (subsequence matching, like the real junegunn/fzf). ' +
        'Standalone, the selected file is opened with cat. As a pipeline ' +
        "source, the selected file's contents feed the rest of the pipe.",
      examples: ['fzf', 'fzf | grep -i kubernetes', 'fzf | less'],
      seeAlso: ['find', 'grep', 'cat']
    },
    run: () => S().setOverlay('fzf')
  },

  vim: vimCommand,
  nvim: { ...vimCommand, hidden: true },
  vi: { ...vimCommand, hidden: true },

  less: lessCommand,
  more: { ...lessCommand, hidden: true },

  man: {
    desc: 'Show the manual page for a command',
    usage: 'man <command>',
    group: 'Session',
    man: {
      description:
        'Displays the manual page for a command in the pager. Pages are ' +
        'generated for every command in this shell; some have extended ' +
        'descriptions and examples. Yes, man man works.',
      examples: ['man ls', 'man fzf', 'man man'],
      seeAlso: ['help', 'less']
    },
    run: ({ args }) => {
      if (!args.length) {
        return printErr("What manual page do you want?\nFor example, try 'man ls'.");
      }
      const name = args[0].toLowerCase();
      if (name === 'woman') return printErr('No manual entry for woman');
      const cmd = COMMANDS[name];
      if (!cmd) return printErr(`No manual entry for ${args[0]}`);
      openLess(`man ${name}`, manPage(name, cmd));
    },
    // In a pipe, emit the page as plain text: `man ls | grep -i recursive`.
    text: ({ args }) => {
      const name = (args[0] ?? '').toLowerCase();
      const cmd = COMMANDS[name];
      return cmd && name !== 'woman' ? manPage(name, cmd) : '';
    }
  },

  open: {
    desc: 'Open a file in a new tab (e.g. open resume.pdf)',
    usage: 'open <file>',
    group: 'Filesystem',
    run: ({ args }) => {
      if (!args.length) return printErr('usage: open <file>  (try: open resume.pdf)');
      const abs = resolvePath(S().cwd, args[0]);
      const node = getNode(abs);
      if (!node) return printErr(`open: ${args[0]}: No such file or directory`);
      if (node.type === 'dir') return printErr(`open: ${args[0]}: Is a directory`);
      const name = basename(abs);
      // Real assets served by the site, keyed by filename.
      const assets: Record<string, string> = { 'resume.pdf': '/resume.pdf' };
      const url = assets[name];
      if (!url) return printErr(`open: ${name}: not an openable document (try: open resume.pdf)`);
      window.open(url, '_blank', 'noopener');
      print(
        <span>
          Opening <span className="t-cyan">{name}</span> in a new tab…{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="t-cyan underline">
            (click here if it didn't open)
          </a>
        </span>
      );
    }
  },

  clear: {
    desc: 'Clear the screen',
    group: 'Session',
    run: () => S().clearLines()
  },

  source: {
    desc: 'Apply a config file (or restart the session)',
    usage: 'source [file]',
    group: 'Session',
    man: {
      description:
        'With a file argument, parses alias/export lines and applies them ' +
        'to the running shell — edit ~/.bashrc in vim, then ' +
        '`source ~/.bashrc` to load your changes. With no argument, ' +
        'restarts the terminal session (which re-applies ~/.bashrc).',
      examples: ['source ~/.bashrc', 'source'],
      seeAlso: ['alias', 'export', 'vim']
    },
    run: ({ args }) => {
      if (!args.length) return startSession();
      const abs = resolvePath(S().cwd, args[0]);
      const node = getNode(abs);
      if (!node || node.type !== 'file') {
        return printErr(`source: ${args[0]}: No such file or directory`);
      }
      let n = 0;
      node.content.split('\n').forEach((l) => {
        if (applyRcLine(l)) n++;
      });
      print(
        <span className="t-dim">
          applied {n} definition{n === 1 ? '' : 's'} from {displayPath(abs)}
        </span>
      );
    }
  },

  kubectl: {
    desc: 'Debug the cluster (something is CrashLoopBackOff)',
    usage: 'kubectl get pods',
    group: 'Session',
    hidden: true,
    man: {
      description:
        'kubectl controls this (fake, but emotionally real) Kubernetes ' +
        'cluster, which currently has a live incident: a pod is in ' +
        'CrashLoopBackOff. Investigate with logs and describe, fix it ' +
        'with set resources or edit (opens vim), then watch the rollout. ' +
        'Your MTTR is being measured. No pressure.',
      examples: [
        'kubectl get pods',
        'kubectl logs <the-crashing-pod>',
        'kubectl describe pod <the-crashing-pod>',
        'kubectl set resources deployment portfolio-web --limits=memory=256Mi',
        'kubectl rollout status deployment/portfolio-web'
      ],
      seeAlso: ['vim', 'htop', 'ssh']
    },
    run: ({ args, flags, rest }) => {
      touchCluster();
      const sub = (args[0] ?? '').toLowerCase();
      const podNames = pods().map((p) => p.name);
      const isCrash = (name?: string) => name === crashPodName();
      const notFound = (pod?: string) =>
        printErr(`Error from server (NotFound): pods "${pod ?? ''}" not found`);

      switch (sub) {
        case 'get': {
          const what = (args[1] ?? '').toLowerCase();
          if (['pods', 'pod', 'po'].includes(what)) {
            print(podTable());
            return maybeCelebrate();
          }
          if (['deployments', 'deployment', 'deploy'].includes(what)) {
            // kubectl get deployment portfolio-web -o yaml — the full manifest,
            // including the CURRENT memory limit.
            if (flags.o && args.some((a) => a.toLowerCase() === 'yaml')) {
              return print(
                <div className="whitespace-pre-wrap">
                  {deployManifest().map((l, i) => (
                    <div key={i} className={/memory:/.test(l) ? 't-yellow' : ''}>
                      {l}
                    </div>
                  ))}
                </div>
              );
            }
            const ready = clusterPhase() === 'healthy' ? '2/2' : '1/2';
            print(
              <div className="whitespace-pre">
                <div className="t-dim">
                  {'NAME             READY   UP-TO-DATE   AVAILABLE   AGE'}
                </div>
                <div>
                  {'portfolio-web    '}
                  <span className={ready === '2/2' ? 't-green' : 't-red font-bold'}>{ready}</span>
                  {'     2            ' + ready[0] + '           12d'}
                </div>
                <div>{'nginx-ingress    1/1     1            1           30d'}</div>
                <div>{'redis-cache      1/1     1            1           30d'}</div>
              </div>
            );
            return maybeCelebrate();
          }
          if (what === 'events') {
            print(
              <div className="whitespace-pre-wrap">
                {clusterPhase() === 'broken'
                  ? `LAST SEEN   TYPE      REASON       OBJECT                    MESSAGE\n` +
                    `30s         Warning   BackOff      pod/${crashPodName()}   Back-off restarting failed container\n` +
                    `45s         Warning   OOMKilling   node/homelab-node-1       Memory cgroup out of memory\n` +
                    `12m         Normal    Scheduled    pod/${crashPodName()}   Successfully assigned default/portfolio-web`
                  : 'LAST SEEN   TYPE     REASON      OBJECT              MESSAGE\n' +
                    '1m          Normal   Pulled      pod/portfolio-web   Container started\n' +
                    '(a suspiciously quiet cluster. well done.)'}
              </div>
            );
            return maybeCelebrate();
          }
          if (!what) {
            return printErr(
              'error: you must specify the type of resource to get (try: kubectl get pods)'
            );
          }
          return printErr(`error: the server doesn't have a resource type "${args[1]}"`);
        }

        case 'logs': {
          const pod = args[1];
          if (!pod) return printErr('error: expected a pod name (run kubectl get pods first)');
          if (!podNames.includes(pod)) return notFound(pod);
          if (isCrash(pod) && clusterPhase() === 'broken') {
            return print(
              <div className="whitespace-pre-wrap">
                {crashLogs()
                  .split('\n')
                  .map((l, i) => (
                    <div key={i} className={/fatal|OOMKilled/.test(l) ? 't-red font-bold' : ''}>
                      {l}
                    </div>
                  ))}
              </div>
            );
          }
          print(
            <div className="t-dim whitespace-pre-wrap">
              {
                '2026/07/07 14:00:01 listening on :80\n2026/07/07 14:00:01 ready. nothing to report. some of us simply do our jobs.'
              }
            </div>
          );
          return maybeCelebrate();
        }

        case 'describe': {
          // kubectl describe deployment portfolio-web — shows the current
          // memory limit and rollout conditions.
          if ((args[1] ?? '').toLowerCase().startsWith('deploy')) {
            if (!/portfolio-web/i.test(rest)) {
              return printErr('usage: kubectl describe deployment portfolio-web');
            }
            const healthy = clusterPhase() === 'healthy';
            return print(
              <div className="whitespace-pre-wrap">
                {describeDeployment(healthy)
                  .split('\n')
                  .map((l, i) => (
                    <div
                      key={i}
                      className={
                        /here is your problem|False/.test(l)
                          ? 't-red'
                          : /memory:|True/.test(l)
                            ? 't-yellow'
                            : ''
                      }
                    >
                      {l}
                    </div>
                  ))}
              </div>
            );
          }
          const pod = args[2] ?? args[1];
          if (!pod || pod === 'pod') return printErr('usage: kubectl describe pod <name>');
          if (!podNames.includes(pod)) return notFound(pod);
          if (isCrash(pod) && clusterPhase() === 'broken') {
            return print(
              <div className="whitespace-pre-wrap">
                {describeCrashPod()
                  .split('\n')
                  .map((l, i) => (
                    <div
                      key={i}
                      className={
                        /OOMKilled|CrashLoopBackOff|BackOff|suspicious/.test(l)
                          ? 't-red'
                          : /^Events|^Containers/.test(l)
                            ? 't-cyan font-bold'
                            : ''
                      }
                    >
                      {l}
                    </div>
                  ))}
              </div>
            );
          }
          print(
            <div className="t-dim whitespace-pre-wrap">
              {`Name:    ${pod}\nStatus:  Running\nEvents:  <none>  (this one is fine. look at the other one.)`}
            </div>
          );
          return maybeCelebrate();
        }

        case 'delete': {
          if ((args[1] ?? '').toLowerCase() !== 'pod') {
            return printErr('usage: kubectl delete pod <name>');
          }
          const pod = args[2];
          if (!pod || !podNames.includes(pod)) return notFound(pod);
          if (isCrash(pod) && clusterPhase() === 'broken') {
            const newName = respawnCrashPod();
            print(<span>pod "{pod}" deleted</span>);
            return print(
              <span className="t-dim">
                (the Deployment immediately created <span className="t-red">{newName}</span> — also
                OOMKilled. deleting pods doesn't raise a memory limit. that's the lesson.)
              </span>
            );
          }
          print(<span>pod "{pod}" deleted</span>);
          print(<span className="t-dim">(a replacement spun up. the cluster is unbothered.)</span>);
          return maybeCelebrate();
        }

        case 'set': {
          if ((args[1] ?? '').toLowerCase() !== 'resources') {
            return printErr(
              'usage: kubectl set resources deployment portfolio-web --limits=memory=256Mi'
            );
          }
          if (!/portfolio-web/i.test(rest)) {
            return printErr('error: deployment not found (the broken one is portfolio-web)');
          }
          const m = rest.match(/--limits[=\s]+memory=(\d+)(mi|gi)/i);
          if (!m) return printErr('error: specify --limits=memory=<size>Mi');
          const mi = m[2].toLowerCase() === 'gi' ? parseInt(m[1], 10) * 1024 : parseInt(m[1], 10);
          applyLimitFix(mi, 'resource requirements updated');
          return maybeCelebrate();
        }

        case 'edit': {
          if (!/portfolio-web/i.test(rest)) {
            return printErr('usage: kubectl edit deployment portfolio-web');
          }
          if (clusterPhase() !== 'broken') {
            print(<span className="t-dim">deployment is healthy — nothing needs editing. 🎉</span>);
            return maybeCelebrate();
          }
          print(
            <span className="t-dim">
              Opening deployment/portfolio-web in $EDITOR (vim, obviously). Find the memory limit,
              press <span className="t-green">i</span> to edit, fix it, then{' '}
              <span className="t-green">Esc</span> and <span className="t-green">:wq</span>.
            </span>
          );
          const path = `/tmp/kubectl-edit-${cluster.suffix}.yaml`;
          return openVim({
            path,
            lines: deployManifest(),
            newFile: true,
            onWrite: (content) => {
              const mi = parseManifestLimit(content);
              if (mi !== null) applyLimitFix(mi, 'edited');
            }
          });
        }

        case 'rollout': {
          const op = (args[1] ?? '').toLowerCase();
          if (!/portfolio-web/i.test(rest)) {
            return printErr('usage: kubectl rollout status deployment/portfolio-web');
          }
          if (op === 'status') {
            const p = clusterPhase();
            if (p === 'broken') {
              return printErr(
                'Waiting for deployment "portfolio-web" rollout to finish: 1 old replicas are pending termination...\n(it will wait forever — the pod is OOMKilled. fix the memory limit.)'
              );
            }
            if (p === 'rolling') {
              return print(
                <span>
                  Waiting for deployment "portfolio-web" rollout to finish:{' '}
                  <span className="t-yellow">1 of 2</span> updated replicas are available...
                </span>
              );
            }
            print(
              <span className="t-green">deployment "portfolio-web" successfully rolled out</span>
            );
            return maybeCelebrate();
          }
          if (op === 'restart') {
            print(<span>deployment.apps/portfolio-web restarted</span>);
            if (clusterPhase() === 'broken') {
              return print(
                <span className="t-dim">
                  (new pod, same 64Mi limit, same OOMKill. a restart is not a memory upgrade.)
                </span>
              );
            }
            return maybeCelebrate();
          }
          return printErr('usage: kubectl rollout status|restart deployment/portfolio-web');
        }

        case '':
          return print(<div className="whitespace-pre-wrap">{KUBECTL_USAGE}</div>);

        default:
          return printErr(
            `error: unknown command "${args[0]}" for "kubectl" — run bare kubectl for usage`
          );
      }
    }
  },

  htop: {
    desc: 'Interactive process viewer',
    group: 'Session',
    hidden: true,
    man: {
      description:
        'An interactive process viewer for this machine. The workload is ' +
        'emotionally accurate: imposter-syndrome pegs a core, ' +
        'coffee.service is essential, side-project is a zombie, and ' +
        'prod-incident is sleeping (for now). q or Esc quits.',
      examples: ['htop', 'q'],
      seeAlso: ['neofetch', 'ping']
    },
    run: () => S().setOverlay('htop')
  },

  top: {
    desc: 'htop for people who miss colors',
    group: 'Session',
    hidden: true,
    run: () => S().setOverlay('htop')
  },

  fortune: {
    desc: 'Print a random, adequate fortune',
    group: 'Session',
    hidden: true,
    man: {
      description:
        'Prints a random epigram of dubious wisdom, tuned for people who ' +
        'carry pagers. Pipes beautifully into cowsay.',
      examples: ['fortune', 'fortune | cowsay'],
      seeAlso: ['cowsay']
    },
    run: () =>
      print(
        <div className="whitespace-pre-wrap">
          {FORTUNES[Math.floor(Math.random() * FORTUNES.length)]}
        </div>
      ),
    text: () => FORTUNES[Math.floor(Math.random() * FORTUNES.length)]
  },

  cowsay: {
    desc: 'A cow that says things',
    usage: 'cowsay <text>',
    group: 'Session',
    hidden: true,
    man: {
      description:
        'An ASCII cow says whatever you tell it to (wrapped at 40 ' +
        'columns), or whatever is piped into it. The cow does not judge.',
      examples: ['cowsay hello there', 'fortune | cowsay', 'echo moo | cowsay'],
      seeAlso: ['fortune', 'echo']
    },
    run: ({ rest }) =>
      print(
        <div className="leading-tight whitespace-pre">
          {cowsayText(rest.replace(/^["']|["']$/g, ''))}
        </div>
      ),
    text: ({ rest }, stdin) => cowsayText(stdin ?? rest.replace(/^["']|["']$/g, ''))
  },

  rm: {
    desc: 'Remove files (careful with that)',
    usage: 'rm [-rf] <path>',
    group: 'Filesystem',
    hidden: true,
    man: {
      description:
        'Removes files. This filesystem is read-only, so individual ' +
        'deletions politely fail. Recursive-force deletion of the root ' +
        'filesystem is, of course, fully supported — every sysadmin ' +
        'deserves to feel that at least once in a safe environment.',
      examples: ['rm file.md', 'rm -rf /   (do it. no one will know.)'],
      seeAlso: ['sudo', 'source']
    },
    run: ({ args, flags }) => {
      const target = args[0] ?? '';
      const nukeTargets = ['/', '/*', '~', '~/', '/home', '/home/visitor'];
      if (flags.r && flags.f && nukeTargets.includes(target)) {
        S().setJob('rmrf');
        return print(<RmRf id={eggId('rmrf')} onReboot={() => startSession()} />);
      }
      if (!args.length) {
        return printErr("rm: missing operand — if you're feeling brave: rm -rf /");
      }
      printErr(`rm: cannot remove '${args[0]}': Read-only file system (nice try)`);
    }
  },

  curl: {
    desc: 'Transfer data from a URL',
    usage: 'curl <url>',
    group: 'Session',
    hidden: true,
    man: {
      description:
        'Fetches things from the internet. The most load-bearing URL on ' +
        'the modern web is parrot.live, and this curl supports it fully. ' +
        'Everything else is DNS problems (it is always DNS).',
      examples: ['curl parrot.live', 'curl matthewjmyrick.com'],
      seeAlso: ['ping']
    },
    run: ({ args }) => {
      if (!args.length) return printErr("curl: try 'curl parrot.live'");
      const url = args[0]
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .toLowerCase();
      if (url === 'parrot.live') {
        S().setJob('parrot');
        return print(<Parrot id={eggId('parrot')} />);
      }
      if (url === 'matthewjmyrick.com' || url === 'www.matthewjmyrick.com') {
        return print(
          <span className="t-dim">
            curl: (3) you are literally already here — put down the curl
          </span>
        );
      }
      if (url === 'wttr.in') {
        return print(
          <span>
            Weather report: <span className="t-yellow">apartment</span> — 22°C, no wind, 0% chance
            of rain. Ideal conditions for self-hosting.
          </span>
        );
      }
      printErr(`curl: (6) Could not resolve host: ${url}`);
    }
  },

  ping: {
    desc: 'Send ICMP echo requests (very fast ones)',
    usage: 'ping <host>',
    group: 'Session',
    hidden: true,
    man: {
      description:
        'Pings a host. Latency may strike you as suspiciously good; the ' +
        'network path between you and this terminal is unusually short. ' +
        'Runs until Ctrl+C, which prints the statistics block.',
      examples: ['ping google.com', 'ping localhost', '^C'],
      seeAlso: ['ssh', 'neofetch']
    },
    run: ({ args }) => {
      if (!args.length) return printErr('usage: ping <host>');
      const host = args[0].toLowerCase();
      const known: Record<string, { ip: string; local?: boolean }> = {
        localhost: { ip: '127.0.0.1', local: true },
        '127.0.0.1': { ip: '127.0.0.1', local: true },
        'matthewjmyrick.com': { ip: '127.0.0.1', local: true }, // you are here
        'google.com': { ip: '142.250.65.78' },
        'github.com': { ip: '140.82.112.4' },
        guestbox: { ip: '192.168.1.42' }
      };
      const target = known[host];
      if (!target) return printErr(`ping: ${host}: Name or service not known`);
      S().setJob('ping');
      print(<Ping id={eggId('ping')} host={host} ip={target.ip} local={target.local} />);
    }
  },

  pacman: {
    desc: 'Package manager (btw)',
    usage: 'pacman -S <pkg>',
    group: 'Session',
    hidden: true,
    man: {
      description:
        'Installs any package you can imagine, at zero cost, with zero ' +
        'effect. The wallpaper should have tipped you off about the ' +
        'operating system situation here. -Syu also behaves as expected ' +
        'for a system this well maintained.',
      examples: ['pacman -S girlfriend', 'pacman -Syu'],
      seeAlso: ['neofetch']
    },
    run: ({ args, flags }) => {
      if (flags.S && flags.y && flags.u) {
        S().setJob('pacman');
        return print(<PacmanInstall id={eggId('pacman')} pkg="" update />);
      }
      if (flags.S) {
        if (!args.length) return printErr('error: no targets specified (use -h for help)');
        S().setJob('pacman');
        return print(<PacmanInstall id={eggId('pacman')} pkg={args[0]} />);
      }
      print(
        <div className="whitespace-pre-wrap">
          {'usage:  pacman <operation> [...]\n' +
            'operations:\n' +
            '    pacman -S <package>   install a package\n' +
            '    pacman -Syu           upgrade the system'}
        </div>
      );
    }
  },

  sl: {
    desc: 'You meant ls. Enjoy the ride.',
    group: 'Session',
    hidden: true,
    man: {
      description:
        'Displays a steam locomotive. The animation cannot be skipped — ' +
        'watching the whole train pass is the traditional punishment for ' +
        'typing too fast. (Fine: Ctrl+C works. Coward.)',
      examples: ['sl'],
      seeAlso: ['ls']
    },
    run: () => {
      S().setJob('sl');
      print(<SlTrain id={eggId('sl')} />);
    }
  },

  emacs: {
    desc: 'The other editor',
    group: 'Session',
    hidden: true,
    run: () => {
      shell.lastExit = 127;
      print(
        <span>
          <span className="t-red">emacs: command not found.</span> This is a{' '}
          <span className="t-green font-bold">vim</span> household.
        </span>
      );
    }
  },

  nano: {
    desc: 'Training wheels',
    group: 'Session',
    hidden: true,
    run: () => {
      shell.lastExit = 127;
      print(
        <span>
          <span className="t-red">nano: command not found.</span> We don't do training wheels here.
          Try <span className="t-green font-bold">vim</span>.
        </span>
      );
    }
  },

  systemctl: {
    desc: 'Control the systemd system (one unit, lovingly)',
    usage: 'systemctl status portfolio',
    group: 'Session',
    hidden: true,
    man: {
      description:
        'Query the state of the only unit that matters here. status shows ' +
        'health and recent journal lines; restart requires privileges you ' +
        'do not have (and the uptime streak is sacred anyway).',
      examples: ['systemctl status portfolio', 'systemctl restart portfolio'],
      seeAlso: ['sudo', 'neofetch', 'crontab']
    },
    run: ({ args }) => {
      const op = (args[0] ?? '').toLowerCase();
      const unit = (args[1] ?? '').replace(/\.service$/, '').toLowerCase();
      if (!op) {
        return print(
          <div className="whitespace-pre-wrap">
            {'usage: systemctl status <unit>\n       systemctl restart <unit>   (bold of you)'}
          </div>
        );
      }
      if (unit && unit !== 'portfolio') {
        return printErr(`Unit ${args[1]}.service could not be found.`);
      }
      if (op === 'status') {
        if (!unit) return printErr('usage: systemctl status portfolio');
        const secs = Math.floor((Date.now() - APP_START) / 1000);
        const mm = Math.floor(secs / 60);
        const since = new Date(APP_START).toString().slice(0, 24);
        return print(
          <div className="whitespace-pre-wrap">
            <div>
              <span className="t-green font-bold">●</span>{' '}
              <span className="font-bold">portfolio.service</span>
              <span className="t-dim"> - Terminal Portfolio (self-hosted, apartment-grade)</span>
            </div>
            <div>
              {'     Loaded: '}
              <span className="t-dim">loaded (/etc/systemd/system/portfolio.service; enabled)</span>
            </div>
            <div>
              {'     Active: '}
              <span className="t-green font-bold">active (running)</span>
              <span className="t-dim">
                {` since ${since}; ${mm > 0 ? `${mm}min` : `${secs}s`} ago (this session)`}
              </span>
            </div>
            <div>{'   Main PID: 1337 (nginx)'}</div>
            <div>
              {'      Tasks: '}1 <span className="t-dim">(limit: hopes)</span>
            </div>
            <div>{'     Memory: 47.0M'}</div>
            <div>
              {'        CPU: '}
              <span className="t-dim">mostly vibes</span>
            </div>
            <div className="t-dim mt-1">
              {`Jul 08 09:17:38 apollo cloudflared[420]: Registered tunnel connection (ewr08)\n` +
                `Jul 08 09:17:38 apollo nginx[1337]: ready to serve\n` +
                `Jul 08 14:02:11 apollo portfolio[1]: visitor connected. showtime.`}
            </div>
          </div>
        );
      }
      if (['restart', 'stop', 'kill', 'disable'].includes(op)) {
        printErr(`Failed to ${op} portfolio.service: Access denied (the uptime streak is sacred)`);
        return print(
          <span className="t-dim">
            See <span className="t-green">sudo</span> if you insist. That will also not work.
          </span>
        );
      }
      printErr(`Unknown command verb ${op}.`);
    }
  },

  crontab: {
    desc: 'Maintain crontab files (view mine)',
    usage: 'crontab -l',
    group: 'Session',
    hidden: true,
    man: {
      description: 'Lists the scheduled jobs on this machine. The schedule is honest.',
      examples: ['crontab -l'],
      seeAlso: ['systemctl', 'date']
    },
    run: ({ flags }) => {
      if (!flags.l) return printErr('usage: crontab -l  (you may look, not touch)');
      print(
        <div className="leading-relaxed whitespace-pre">
          <div className="t-dim"># m h dom mon dow command</div>
          <div>
            <span className="t-yellow">{'0 3 * * *        '}</span>/usr/local/bin/backup.sh{' '}
            <span className="t-dim">&& /usr/bin/pray</span>
          </div>
          <div>
            <span className="t-yellow">{'@reboot          '}</span>echo{' '}
            <span className="t-string">"there's no place like 127.0.0.1"</span>
          </div>
          <div>
            <span className="t-yellow">{'0 9 * * 1-5      '}</span>/usr/bin/coffee{' '}
            <span className="t-dim">--double --no-sugar</span>
          </div>
          <div>
            <span className="t-yellow">{'*/5 * * * *      '}</span>
            check-if-site-still-up.sh <span className="t-dim"># it is. it always is.</span>
          </div>
          <div>
            <span className="t-yellow">{'0 0 1 1 *        '}</span>rotate-secrets.sh{' '}
            <span className="t-dim"># new year, new hunter2</span>
          </div>
        </div>
      );
    }
  },

  su: {
    desc: 'Switch user (requires the password)',
    usage: 'su [user]',
    group: 'Session',
    hidden: true,
    man: {
      description:
        'Switches to another user after password authentication. The ' +
        'password prompt is real in the ways that matter: nothing you ' +
        'type is echoed, stored, or remembered. Authentication, however, ' +
        'always fails. It is not personal.',
      examples: ['su matthew', 'su -', '^C to give up with dignity'],
      seeAlso: ['sudo', 'whoami']
    },
    run: () => startSu()
  },

  sudo: {
    desc: 'Execute a command as another user (lol, no)',
    usage: 'sudo <command>',
    group: 'Session',
    hidden: true, // a discovery egg — tab-completes, but not in help
    man: {
      description:
        'Executes a command with the security privileges of another user. ' +
        'You, however, are `visitor`. Every attempt is logged. Keep trying ' +
        'and someone will hear about it.',
      examples: ['sudo rm -rf /', 'sudo !!'],
      seeAlso: ['whoami', 'ssh']
    },
    run: ({ rest }) => {
      if (!rest.trim()) {
        return printErr('usage: sudo <command>');
      }
      sudoAttempts++;
      printErr('visitor is not in the sudoers file.  This incident will be reported.');
      if (sudoAttempts === 3) {
        print(
          <div className="mt-1">
            <span className="t-yellow">You have new mail.</span>
            <div className="t-dim">
              From: root@homelab — subject: <span className="italic">"he's trying again."</span>
            </div>
          </div>
        );
      } else if (sudoAttempts > 3 && sudoAttempts % 3 === 0) {
        print(
          <span className="t-dim">
            (attempt #{sudoAttempts} has been reported. root is no longer surprised.)
          </span>
        );
      }
    }
  },

  ssh: {
    desc: 'Connect to another host (try: ssh guestbox)',
    usage: 'ssh <host>',
    group: 'Session',
    man: {
      description:
        'Opens a connection to another machine on the (entirely fictional) ' +
        "network. The prompt changes, and you get that host's own " +
        'filesystem — look around. `exit` (or Ctrl+D energy) brings you ' +
        'home. Currently the only reachable host is guestbox.',
      examples: ['ssh guestbox', 'exit'],
      seeAlso: ['exit', 'whoami']
    },
    run: ({ args }) => {
      if (!args.length) return printErr('usage: ssh <host>  (hint: ssh guestbox)');
      const target = args[0].replace(/^visitor@/, '').toLowerCase();
      if (S().host === 'guestbox') {
        return printErr(`ssh: connect to host ${target}: Network is unreachable (this is a Pi)`);
      }
      if (target !== 'guestbox') {
        return printErr(`ssh: Could not resolve hostname ${target}: Name or service not known`);
      }
      setActiveRoot(GUEST_ROOT);
      S().setHost('guestbox');
      S().setCwd(HOME);
      shell.env.set('HOSTNAME', 'guestbox');
      print(
        <div>
          <div className="t-dim">
            Warning: Permanently added 'guestbox' (ED25519) to the list of known hosts.
          </div>
          <div className="mt-1">
            Welcome to <span className="t-magenta font-bold">guestbox</span> — a spare Raspberry Pi
            in a closet. Uptime: 420 days.
          </div>
          <div className="t-dim">
            Try <span className="t-green">ls</span> (maybe <span className="t-green">ls -a</span>
            …), <span className="t-green">cat motd</span> — and{' '}
            <span className="t-green">exit</span> to go home.
          </div>
        </div>
      );
    }
  },

  exit: {
    desc: 'Close the connection (or try to leave)',
    group: 'Session',
    hidden: true,
    run: () => {
      if (S().host === 'guestbox') {
        setActiveRoot(ROOT);
        S().setHost('portfolio');
        S().setCwd(HOME);
        shell.env.set('HOSTNAME', 'portfolio');
        return print(<span>Connection to guestbox closed.</span>);
      }
      print(
        <span>
          logout
          <br />
          <span className="t-dim">There's no place like 127.0.0.1 — you can never leave. 🏡</span>
        </span>
      );
    }
  },

  alias: {
    desc: 'Define or list command aliases',
    usage: "alias [name='value']",
    group: 'Session',
    man: {
      description:
        'With no arguments, lists the aliases in effect. With ' +
        "name='value', defines one for the session — the alias expands in " +
        'command position, including after pipes, and may itself contain ' +
        'pipes. Defaults come from ~/.bashrc at session start.',
      examples: ["alias ll='ls -la'", "alias findmd='ls -R | grep md'", 'alias'],
      seeAlso: ['unalias', 'source', 'env']
    },
    run: ({ rest }) => {
      const r = rest.trim();
      if (!r) {
        if (!shell.aliases.size) {
          return print(<span className="t-dim">(no aliases — try: alias ll='ls -la')</span>);
        }
        const lines = [...shell.aliases]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, v]) => `alias ${k}='${v}'`);
        return print(<div className="whitespace-pre-wrap">{lines.join('\n')}</div>);
      }
      if (applyRcLine('alias ' + r)) return;
      const one = shell.aliases.get(r);
      if (one !== undefined) return print(<span>{`alias ${r}='${one}'`}</span>);
      printErr("alias: invalid syntax — try: alias ll='ls -la'");
    },
    text: () =>
      [...shell.aliases]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `alias ${k}='${v}'`)
        .join('\n')
  },

  unalias: {
    desc: 'Remove an alias',
    usage: 'unalias <name> | -a',
    group: 'Session',
    hidden: true,
    run: ({ args, flags }) => {
      if (flags.a) return void shell.aliases.clear();
      if (!args.length) return printErr('usage: unalias <name> (or unalias -a)');
      if (!shell.aliases.delete(args[0])) printErr(`unalias: ${args[0]}: not found`);
    }
  },

  export: {
    desc: 'Set an environment variable',
    usage: 'export NAME=value',
    group: 'Session',
    man: {
      description:
        'Sets an environment variable for the session. Reference it with ' +
        '$NAME or ${NAME} anywhere on a command line (double quotes ok, ' +
        'single quotes suppress expansion, just like bash).',
      examples: ['export NAME=matthew', 'echo hello $NAME', 'echo $HOME $USER $?'],
      seeAlso: ['env', 'echo', 'alias']
    },
    run: ({ rest }) => {
      const r = rest.trim();
      if (!r) {
        const lines = [...shell.env].map(([k, v]) => `declare -x ${k}="${v}"`);
        return print(<div className="whitespace-pre-wrap">{lines.join('\n')}</div>);
      }
      if (!applyRcLine('export ' + r)) printErr('export: usage: export NAME=value');
    }
  },

  env: {
    desc: 'List environment variables',
    group: 'Session',
    hidden: true,
    run: () =>
      print(
        <div className="whitespace-pre-wrap">
          {[...shell.env].map(([k, v]) => `${k}=${v}`).join('\n')}
        </div>
      ),
    text: () => [...shell.env].map(([k, v]) => `${k}=${v}`).join('\n')
  },

  neofetch: {
    desc: 'Show system info + Tux',
    group: 'Session',
    run: () => print(neofetch())
  },

  whoami: {
    desc: 'Print the current user',
    group: 'Session',
    run: () => print(<span>visitor</span>),
    text: () => 'visitor'
  },

  echo: {
    desc: 'Print text',
    usage: 'echo <text>',
    group: 'Session',
    run: ({ rest }) => print(<span className="whitespace-pre-wrap">{rest}</span>),
    text: ({ rest }) => rest
  },

  date: {
    desc: 'Show the current date/time',
    group: 'Session',
    run: () => print(<span>{new Date().toString()}</span>)
  },

  history: {
    desc: 'Show command history',
    group: 'Session',
    run: () =>
      print(
        <div className="whitespace-pre-wrap">
          {S().history.map((c, i) => (
            <div key={i}>
              <span className="t-dim">{String(i + 1).padStart(4)} </span>
              {c}
            </div>
          ))}
        </div>
      ),
    text: () => S().history.join('\n')
  },

  theme: {
    desc: 'Pick a color theme (interactive)',
    usage: 'theme [name]',
    group: 'Customize',
    run: ({ args }) => {
      if (!args.length) return S().setOverlay('theme'); // interactive picker
      const name = args[0];
      if (!isThemeName(name)) return printErr(`theme: unknown theme "${name}" (try: theme)`);
      S().setTheme(name);
      print(
        <span>
          Theme set to <span className="t-accent font-bold">{THEMES[name].label}</span>
        </span>
      );
    }
  },

  term: {
    desc: 'Pick a terminal style (interactive)',
    usage: 'term [name]',
    group: 'Customize',
    run: ({ args }) => {
      if (!args.length) return S().setOverlay('term'); // interactive picker
      const name = args[0];
      if (!isTermType(name)) return printErr(`term: unknown terminal "${name}" (try: term)`);
      // Apply the terminal's whole personality (theme + font + prompt) and
      // restart the session, like opening a fresh terminal app.
      S().setTerm(name);
      S().setTheme(TERMINALS[name].theme);
      startSession();
    }
  },

  opacity: {
    desc: 'Set terminal transparency (30-100)',
    usage: 'opacity [30-100]',
    group: 'Customize',
    run: ({ args }) => {
      if (!args.length) return print(<span>opacity is {Math.round(S().opacity * 100)}%</span>);
      const n = parseInt(args[0], 10);
      if (isNaN(n)) return printErr('opacity: expected a number 30-100');
      S().setOpacity(n / 100);
      print(<span>opacity set to {Math.round(S().opacity * 100)}%</span>);
    }
  },

  // ---- "Matthew" shortcuts ----
  about: { desc: 'About me + where to look', group: 'Matthew', run: () => print(aboutCard()) },
  resume: { desc: 'My resume summary', group: 'Matthew', run: () => catFile('resume.md') },
  skills: { desc: 'My technical skills', group: 'Matthew', run: () => catFile('skills.md') },
  education: { desc: 'My education', group: 'Matthew', run: () => catFile('education.md') },
  contact: { desc: 'How to reach me', group: 'Matthew', run: () => catFile('contact.md') },
  email: {
    desc: 'Open an email to me',
    group: 'Matthew',
    run: () => {
      const addr = 'matthewmyrick2@gmail.com';
      window.location.href = `mailto:${addr}`;
      print(
        <span>
          Opening your mail client to{' '}
          <a href={`mailto:${addr}`} className="t-cyan underline">
            {addr}
          </a>
          …
        </span>
      );
    }
  },
  projects: { desc: 'My projects', group: 'Matthew', run: () => catFile('projects/README.md') },

  experience: {
    desc: 'My work experience',
    usage: 'experience [company]',
    group: 'Matthew',
    run: ({ args }) => {
      const dir = getNode(resolvePath(HOME, 'experience'));
      if (!dir || dir.type !== 'dir') return;
      if (!args.length) {
        const entries = listDir(dir);
        return print(
          <div>
            <div className="t-accent font-bold">Companies:</div>
            {entries.map((e, i) => (
              <div key={i} className="t-cyan">
                • {e.name.replace(/\.md$/, '')}
              </div>
            ))}
            <div className="t-dim mt-1">
              Run: experience &lt;company&gt; (e.g. experience ab-inbev)
            </div>
          </div>
        );
      }
      const key = args[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = Object.keys(dir.children).find(
        (n) => n.replace(/\.md$/, '').replace(/[^a-z0-9]/g, '') === key
      );
      if (!match) return printErr(`experience: no company matching "${args[0]}"`);
      catFile('experience/' + match);
    }
  },

  hire: {
    desc: "Let's talk — contact + resume in one place",
    group: 'Matthew',
    man: {
      description:
        'The shortcut for recruiters and founders: who I am in one line, ' +
        'what I do, and every way to reach me — email, the real resume ' +
        'PDF, LinkedIn, GitHub.',
      examples: ['hire', 'email', 'open resume.pdf'],
      seeAlso: ['about', 'contact', 'email']
    },
    run: () =>
      print(
        <div className="max-w-2xl space-y-3">
          <div>
            <div className="t-accent text-base font-bold">Let's build something reliable.</div>
            <div className="t-dim">
              Infrastructure / Platform Engineer · SRE Lead · NYC (remote-friendly)
            </div>
          </div>
          <div>
            I run Kubernetes fleets at scale, build observability and deploy pipelines, and keep
            things up when it matters — currently founding infra lead at Hadrius AI (
            <span className="t-orange font-semibold">YC</span>). This entire site (self-hosted,
            tunneled, zero-downtime deploys from my apartment) is the live demo.
          </div>
          <div className="space-y-0.5">
            <div className="flex gap-3">
              <span className="t-green w-28 shrink-0">email</span>
              <a href="mailto:matthewmyrick2@gmail.com" className="t-cyan underline">
                matthewmyrick2@gmail.com
              </a>
            </div>
            <div className="flex gap-3">
              <span className="t-green w-28 shrink-0">resume</span>
              <a
                href="/resume.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="t-cyan underline"
              >
                the real PDF (opens in a new tab)
              </a>
            </div>
            <div className="flex gap-3">
              <span className="t-green w-28 shrink-0">linkedin</span>
              <a
                href="https://www.linkedin.com/in/mattmyrick/"
                target="_blank"
                rel="noopener noreferrer"
                className="t-cyan underline"
              >
                linkedin.com/in/mattmyrick
              </a>
            </div>
            <div className="flex gap-3">
              <span className="t-green w-28 shrink-0">github</span>
              <a
                href="https://github.com/matthewmyrick"
                target="_blank"
                rel="noopener noreferrer"
                className="t-cyan underline"
              >
                github.com/matthewmyrick
              </a>
            </div>
          </div>
          <div className="t-dim">
            Fastest path: run <span className="t-green">email</span> — it opens your mail client
            already addressed.
          </div>
        </div>
      )
  },

  game: {
    desc: 'Play a number-guessing game',
    group: 'Matthew',
    run: () => {
      const target = Math.floor(Math.random() * 100) + 1;
      S().setGame({ active: true, target, attempts: 0, max: 7 });
      printText(GAME_INTRO);
    }
  },

  'dance-battle': {
    desc: 'Challenge me to a dance-off',
    group: 'Matthew',
    run: () =>
      print(
        <div>
          <div className="t-accent">You have been challenged to a dance battle!</div>
          <img src="/dancer.gif" alt="dance battle" className="mt-2 h-48 w-auto rounded" />
        </div>
      )
  }
};

export const COMMAND_NAMES = new Set(Object.keys(COMMANDS));

function CmdRow({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="t-green w-28 shrink-0">{name}</span>
      <span className="t-dim">{desc}</span>
    </div>
  );
}

// Grouped list of commands (shared by `help` and `about`). `exclude` drops
// groups; `all` appends the hidden easter eggs (skipping pure aliases like
// vi/nvim, which share their run function with a visible command).
function commandList(exclude: Command['group'][] = [], all = false): ReactNode {
  const groups = (['Filesystem', 'Customize', 'Session', 'Matthew'] as Command['group'][]).filter(
    (g) => !exclude.includes(g)
  );
  const visibleRuns = new Set(
    Object.values(COMMANDS)
      .filter((c) => !c.hidden)
      .map((c) => c.run)
  );
  const eggs = Object.entries(COMMANDS).filter(([, c]) => c.hidden && !visibleRuns.has(c.run));
  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <div key={g} className="space-y-0.5">
          <div className="t-cyan font-bold">{g}</div>
          {Object.entries(COMMANDS)
            .filter(([, c]) => c.group === g && !c.hidden)
            .map(([name, c]) => (
              <CmdRow key={name} name={name} desc={c.desc} />
            ))}
        </div>
      ))}
      {all && (
        <div className="space-y-0.5">
          <div className="t-yellow font-bold">Easter eggs & extras 🥚</div>
          {eggs.map(([name, c]) => (
            <CmdRow key={name} name={name} desc={c.desc} />
          ))}
        </div>
      )}
    </div>
  );
}

function aboutCard(): ReactNode {
  const explore: [string, string][] = [
    ['projects', "things I've built"],
    ['experience', "where I've worked"],
    ['skills', 'my tech stack'],
    ['education', 'where I studied'],
    ['resume', 'the one-page summary'],
    ['open resume.pdf', 'the real PDF, in a new tab'],
    ['contact', 'how to reach me'],
    ['hire', "let's talk"]
  ];
  return (
    <div className="max-w-2xl space-y-3">
      <div>
        <div className="t-accent text-base font-bold">Matthew Myrick</div>
        <div className="t-dim">Infrastructure / Platform Engineer · SRE Lead · NYC</div>
      </div>
      <div className="space-y-2">
        <div>
          I'm an infrastructure / platform engineer and SRE. I'm currently the founding
          infrastructure lead at Hadrius AI (<span className="t-orange font-semibold">YC</span>),
          running a 600+ node Kubernetes fleet, the observability and deploy pipelines, and keeping
          things up at a 99.9% SLA.
        </div>
        <div>
          I like terminals, automation, Postgres internals, and owning the whole stack — literally.
          This site is self-hosted from my home lab (you're talking to a box in my apartment right
          now).
        </div>
      </div>
      <div>
        <div className="t-cyan mb-1 font-bold">Available options</div>
        <div className="space-y-0.5">
          {explore.map(([n, d]) => (
            <CmdRow key={n} name={n} desc={d} />
          ))}
        </div>
      </div>
      <div className="t-dim">
        Run <span className="t-green">help</span> for all commands.
      </div>
    </div>
  );
}

function helpOutput(all = false): ReactNode {
  return (
    <div className="max-w-6xl space-y-3">
      <div>
        <span className="t-dim">New here? Start with </span>
        <span className="t-green font-bold">about</span>
        <span className="t-dim"> — it covers who I am, my experience, and projects.</span>
      </div>
      <div className="t-accent font-bold">Available commands</div>
      {commandList(['Matthew'], all)}
      <div className="t-dim">
        Keys: <span className="t-yellow">Tab</span> complete · <span className="t-yellow">↑/↓</span>{' '}
        history · <span className="t-yellow">Ctrl+R</span> search ·{' '}
        <span className="t-yellow">Ctrl+L</span> clear · <span className="t-yellow">Ctrl+C</span>{' '}
        cancel
      </div>
      {!all && (
        <div className="t-dim">
          Psst — there's more. <span className="t-green">help -a</span> shows everything. 🥚
        </div>
      )}
    </div>
  );
}

// Tagline + welcome, shown at session start and by `source`.
export function startSession(): void {
  const st = S();
  st.clearLines();
  // A new session always starts back on the portfolio host.
  if (st.host !== 'portfolio') {
    setActiveRoot(ROOT);
    st.setHost('portfolio');
    st.setCwd(HOME);
  }
  // Fresh incident for a fresh session (survives `clear`, resets on `source`).
  resetCluster();
  // Fresh shell state, then apply ~/.bashrc (including any vim edits).
  resetShellSession();
  const rc = getNode(HOME + '/.bashrc');
  if (rc && rc.type === 'file') rc.content.split('\n').forEach(applyRcLine);
  st.print(<div className="t-accent text-base font-bold">There's no place like 127.0.0.1 🏡</div>);
  st.print(
    <div className="mt-1">
      <div>Welcome to my interactive portfolio terminal — self-hosted from my apartment!</div>
      <div className="t-dim">
        Run <span className="t-green font-bold">about</span> (or{' '}
        <span className="t-green">cat about.md</span>) to learn about me, or{' '}
        <span className="t-green font-bold">help</span> for all commands.
      </div>
    </div>
  );
}
