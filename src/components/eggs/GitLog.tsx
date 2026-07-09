import { useEffect, useRef, useState } from 'react';

// `git log` — the REAL commit history of this repo, fetched live from the
// public GitHub API (the repo has no .git at runtime; this is better anyway:
// it's never stale). Cached for the session; fails gracefully offline.

interface Commit {
  hash: string;
  date: string;
  author: string;
  subject: string;
}

let cache: Commit[] | null = null;

async function fetchCommits(): Promise<Commit[]> {
  if (cache) return cache;
  const res = await fetch(
    'https://api.github.com/repos/matthewmyrick/portfolio-site/commits?per_page=20',
    { headers: { Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as {
    sha: string;
    commit: { author: { name: string; date: string }; message: string };
  }[];
  cache = data.map((c) => ({
    hash: c.sha.slice(0, 7),
    date: c.commit.author.date.slice(0, 10),
    author: c.commit.author.name,
    subject: c.commit.message.split('\n')[0].slice(0, 72)
  }));
  return cache;
}

export function GitLog({ oneline }: { oneline?: boolean }) {
  const [commits, setCommits] = useState<Commit[] | null>(cache);
  const [error, setError] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // The log arrives async (API fetch) after the terminal already scrolled —
  // follow it down once it renders.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [commits, error]);

  useEffect(() => {
    if (cache) return;
    fetchCommits()
      .then(setCommits)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <span className="t-red">
        fatal: unable to reach origin (github api rate limit, probably — try again in a bit)
      </span>
    );
  }
  if (!commits) return <span className="t-dim">fetching origin…</span>;

  if (oneline) {
    return (
      <div className="whitespace-pre-wrap">
        {commits.map((c) => (
          <div key={c.hash}>
            <span className="t-yellow">{c.hash}</span> {c.subject}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    );
  }
  return (
    <div className="whitespace-pre-wrap">
      {commits.map((c) => (
        <div key={c.hash} className="mb-2">
          <div>
            <span className="t-yellow">commit {c.hash}</span>
          </div>
          <div className="t-dim">
            Author: {c.author} · Date: {c.date}
          </div>
          <div className="mt-0.5 pl-4">{c.subject}</div>
        </div>
      ))}
      <div className="t-dim">
        (latest 20 — live from the GitHub API, because the repo is public)
      </div>
      <div ref={endRef} />
    </div>
  );
}
