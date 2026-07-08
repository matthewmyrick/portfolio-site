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
import { openLess } from './components/Less';
import { SlTrain } from './components/eggs/SlTrain';
import { shell, resetShellSession, applyRcLine } from './lib/shell';

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

// sudo attempts this session (module-level: survives `clear` and `source`).
let sudoAttempts = 0;

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
      'u undo. :w writes to the session filesystem (cat and grep see your ' +
      'edits), :q quits, :q! quits without saving, :wq does both, :<n> ' +
      'jumps to a line. Changes last until you reload the page.',
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
        newFile: false
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

// ---- registry ------------------------------------------------------------
export const COMMANDS: Record<string, Command> = {
  help: {
    desc: 'Show this help message',
    group: 'Session',
    run: () => print(helpOutput())
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
      print(<SlTrain />);
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

// Grouped list of commands (shared by `help` and `about`). `exclude` drops groups.
function commandList(exclude: Command['group'][] = []): ReactNode {
  const groups = (['Filesystem', 'Customize', 'Session', 'Matthew'] as Command['group'][]).filter(
    (g) => !exclude.includes(g)
  );
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
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
    ['contact', 'how to reach me']
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

function helpOutput(): ReactNode {
  return (
    <div className="max-w-4xl space-y-3">
      <div>
        <span className="t-dim">New here? Start with </span>
        <span className="t-green font-bold">about</span>
        <span className="t-dim"> — it covers who I am, my experience, and projects.</span>
      </div>
      <div className="t-accent font-bold">Available commands</div>
      {commandList(['Matthew'])}
      <div className="t-dim">
        Keys: <span className="t-yellow">Tab</span> complete · <span className="t-yellow">↑/↓</span>{' '}
        history · <span className="t-yellow">Ctrl+L</span> clear ·{' '}
        <span className="t-yellow">Ctrl+C</span> cancel
      </div>
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
