import { ROOT, HOME, type FsNode, type DirNode } from './filesystem';

export { HOME } from './filesystem';

export function isDir(node: FsNode | null): node is DirNode {
  return !!node && node.type === 'dir';
}

// Resolve a possibly-relative path (against cwd) to a normalized absolute path.
export function resolvePath(cwd: string, input: string): string {
  let base: string[];
  if (!input || input === '~') {
    return HOME;
  }
  if (input.startsWith('~/')) {
    base = HOME.split('/').filter(Boolean);
    input = input.slice(2);
  } else if (input === '/') {
    return '/';
  } else if (input.startsWith('/')) {
    base = [];
  } else {
    base = cwd.split('/').filter(Boolean);
  }

  for (const part of input.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      base.pop();
    } else {
      base.push(part);
    }
  }
  return '/' + base.join('/');
}

export function getNode(absPath: string): FsNode | null {
  if (absPath === '/') return ROOT;
  const parts = absPath.split('/').filter(Boolean);
  let node: FsNode = ROOT;
  for (const part of parts) {
    if (!isDir(node)) return null;
    const next: FsNode | undefined = node.children[part];
    if (!next) return null;
    node = next;
  }
  return node;
}

// Display an absolute path with ~ shorthand for HOME.
export function displayPath(absPath: string): string {
  if (absPath === HOME) return '~';
  if (absPath.startsWith(HOME + '/')) return '~' + absPath.slice(HOME.length);
  return absPath;
}

export function basename(absPath: string): string {
  const parts = absPath.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '/';
}

export interface DirEntry {
  name: string;
  isDir: boolean;
}

export function listDir(node: DirNode, includeHidden = false): DirEntry[] {
  return Object.entries(node.children)
    .filter(([name]) => includeHidden || !name.startsWith('.'))
    .map(([name, child]) => ({ name, isDir: child.type === 'dir' }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export interface WalkedFile {
  path: string; // absolute
  content: string;
}

// Recursively collect every file under an absolute dir path.
export function walkFiles(absDir: string): WalkedFile[] {
  const out: WalkedFile[] = [];
  const start = getNode(absDir);
  const recurse = (node: FsNode, prefix: string) => {
    if (node.type === 'file') {
      out.push({ path: prefix, content: node.content });
      return;
    }
    for (const [name, child] of Object.entries(node.children)) {
      if (name.startsWith('.')) continue; // keep hidden files out of grep/find/fzf
      recurse(child, prefix === '/' ? '/' + name : prefix + '/' + name);
    }
  };
  if (start) recurse(start, absDir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
