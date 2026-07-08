// Animated easter eggs live in the scrollback as React components. When a
// fullscreen app (vim/less/htop) opens, the scrollback unmounts — and on
// remount every egg would replay its animation from the start (ghost trains).
// Finished eggs store their final state here, keyed by a per-invocation id,
// and render that ending statically on remount instead of replaying.
const results = new Map<string, unknown>();

export function eggResult<T>(id: string): T | undefined {
  return results.get(id) as T | undefined;
}

export function setEggResult(id: string, value: unknown): void {
  results.set(id, value);
}

let n = 0;
export const eggId = (kind: string) => `${kind}-${++n}-${Date.now()}`;
