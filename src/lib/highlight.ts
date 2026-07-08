import { resolvePath, getNode } from './fsops';

// Compute a per-character CSS class for the current input line so it can be
// rendered with live syntax highlighting:
//   command (incl. after a pipe) → green / red,  flags → yellow,
//   quoted strings → soft yellow,  existing paths → cyan,  pipe → dim.
export function highlightClasses(input: string, commands: Set<string>, cwd: string): string[] {
  const classes = new Array<string>(input.length).fill('');
  const re = /"[^"]*"|'[^']*'|[^\s]+/g;
  let m: RegExpExecArray | null;
  let expectCommand = true; // true at line start and right after a pipe
  while ((m = re.exec(input)) !== null) {
    const text = m[0];
    const start = m.index;
    const end = start + text.length;
    let cls = '';
    if (text === '|' || text === '&&' || text === '||' || text === ';') {
      cls = 't-dim';
      expectCommand = true;
    } else if (expectCommand) {
      cls = commands.has(text.toLowerCase()) ? 't-green' : 't-red';
      expectCommand = false;
    } else if (text.startsWith('"') || text.startsWith("'")) {
      cls = 't-string';
    } else if (text.startsWith('-')) {
      cls = 't-yellow';
    } else {
      const bare = text.replace(/^["']|["']$/g, '');
      cls = getNode(resolvePath(cwd, bare)) ? 't-cyan' : '';
    }
    for (let i = start; i < end; i++) classes[i] = cls;
  }
  return classes;
}
