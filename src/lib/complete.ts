import { resolvePath, getNode, listDir } from './fsops';
import { COMMAND_NAMES } from '../commands';

export interface CompleteResult {
  value: string;
  cursor: number;
  list: string[]; // suggestions to display when ambiguous
}

function longestCommonPrefix(strs: string[]): string {
  if (!strs.length) return '';
  let prefix = strs[0];
  for (const s of strs) {
    while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) break;
  }
  return prefix;
}

// Tab-completion for the current input. Completes the first token against
// command names, and later tokens against filesystem paths.
export function complete(input: string, cwd: string): CompleteResult {
  const unchanged: CompleteResult = { value: input, cursor: input.length, list: [] };
  const endsWithSpace = /\s$/.test(input);
  const tokens = input.split(/\s+/).filter(Boolean);
  const completingCommand = tokens.length === 0 || (tokens.length === 1 && !endsWithSpace);

  const partial = endsWithSpace ? '' : (tokens[tokens.length - 1] ?? '');
  const tokenStart = input.length - partial.length;
  const before = input.slice(0, tokenStart);

  if (completingCommand) {
    const matches = [...COMMAND_NAMES].filter((n) => n.startsWith(partial.toLowerCase())).sort();
    if (!matches.length) return unchanged;
    if (matches.length === 1) {
      const value = matches[0] + ' ';
      return { value, cursor: value.length, list: [] };
    }
    const lcp = longestCommonPrefix(matches);
    const value = before + lcp;
    return { value, cursor: value.length, list: lcp === partial ? matches : [] };
  }

  // Path completion on the last token.
  const slash = partial.lastIndexOf('/');
  const dirPart = slash === -1 ? '' : partial.slice(0, slash + 1);
  const basePart = slash === -1 ? partial : partial.slice(slash + 1);
  const dirNode = getNode(resolvePath(cwd, dirPart || '.'));
  if (!dirNode || dirNode.type !== 'dir') return unchanged;

  const matches = listDir(dirNode)
    .filter((e) => e.name.startsWith(basePart))
    .map((e) => e.name + (e.isDir ? '/' : ''));
  if (!matches.length) return unchanged;

  if (matches.length === 1) {
    const name = matches[0];
    let value = before + dirPart + name;
    if (!name.endsWith('/')) value += ' ';
    return { value, cursor: value.length, list: [] };
  }
  const lcp = longestCommonPrefix(matches);
  const value = before + dirPart + lcp;
  return { value, cursor: value.length, list: lcp === basePart ? matches : [] };
}

// A single concrete suggestion (>= input) for the inline gray "ghost" autofill.
// Completes the command (incl. after a pipe) or the last path token.
export function suggest(input: string, cwd: string): string | null {
  if (!input) return null;
  // Work on the segment after the last pipe/chain operator, keeping the prefix.
  const ops = [...input.matchAll(/\|\||&&|;|\|/g)];
  const lastOp = ops.length ? ops[ops.length - 1] : null;
  const cut = lastOp ? (lastOp.index ?? 0) + lastOp[0].length : 0;
  const prefix = input.slice(0, cut);
  const segRaw = input.slice(cut);
  const lead = segRaw.slice(0, segRaw.length - segRaw.replace(/^\s+/, '').length);
  const seg = segRaw.slice(lead.length);
  if (seg === '' || /\s$/.test(seg)) return null;

  const tokens = seg.split(/\s+/);
  if (tokens.length === 1) {
    const partial = tokens[0].toLowerCase();
    const match = [...COMMAND_NAMES].sort().find((n) => n.startsWith(partial) && n !== partial);
    return match ? prefix + lead + match : null;
  }

  const partial = tokens[tokens.length - 1];
  const before = seg.slice(0, seg.length - partial.length);
  const slash = partial.lastIndexOf('/');
  const dirPart = slash === -1 ? '' : partial.slice(0, slash + 1);
  const basePart = slash === -1 ? partial : partial.slice(slash + 1);
  const dirNode = getNode(resolvePath(cwd, dirPart || '.'));
  if (!dirNode || dirNode.type !== 'dir') return null;
  const entry = listDir(dirNode).find((e) => e.name.startsWith(basePart) && e.name !== basePart);
  if (!entry) return null;
  return prefix + lead + before + dirPart + entry.name + (entry.isDir ? '/' : '');
}
