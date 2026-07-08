# 🖥️ Terminal Portfolio — Matthew Myrick

> _"There's no place like 127.0.0.1"_ 🏠

An interactive, terminal-style personal site. Instead of scrolling a page, you explore a real-ish **virtual filesystem** with actual shell commands — `ls`, `cd`, `cat`, `grep`, `fzf`, and more.

### 🔗 Live: **[matthewjmyrick.com](https://matthewjmyrick.com)** — self-hosted from my home lab.

I'm Matthew Myrick, an **infrastructure / platform engineer & SRE**. The fastest way to read my **résumé** is right in the site:

```sh
about              # who I am + what to look at
cat resume.md      # the one-page résumé
ls experience/     # then: cat experience/hadrius-ai.md
cat projects/README.md
```

## ✨ Features

- **Virtual filesystem** — navigate `~/about.md`, `~/experience/`, `~/projects/`, etc. with real commands.
- **Unix-ish commands** — `pwd`, `ls` (`-l`/`-a`/`-R`), `cd`, `cat` (bat-style), `grep`, `find`, plus pipes (`cat resume.md | grep -i kubernetes`).
- **`fzf`** — a terminal-native fuzzy finder. Standalone opens a file; `fzf | grep foo` searches inside the file you pick.
- **Live syntax highlighting** as you type, plus gray **autosuggest** (Tab / → to accept).
- **Themes** — Catppuccin (4 flavors), Dracula, Gruvbox, Tokyo Night, Nord — pick interactively with `theme`.
- **Terminal styles** — `term` switches between Ghostty, iTerm2, and Warp looks (chrome, font, prompt, palette).
- **Quality-of-life** — command history (↑/↓), `Ctrl+L` clear, `Ctrl+C` cancel, adjustable transparency (`opacity`).
- Type `help` to see everything. (There may be an easter egg or two. 🐧)

## 🧱 Tech

React 19 · Vite · TypeScript · Tailwind CSS v4 · zustand — a fully static SPA, self-hosted from my home lab.

## 🗂️ Project layout

Everything is client-side; the app lives at the repository root.

```
src/
├── lib/
│   ├── filesystem.ts   # the virtual filesystem tree + content
│   ├── fsops.ts        # path resolution, ls, cat, grep, walk
│   ├── render.tsx      # text -> themed React nodes
│   ├── highlight.ts    # live input highlighting
│   ├── complete.ts     # Tab completion + autosuggest
│   ├── themes.ts       # color palettes (CSS variables)
│   └── terminals.ts    # terminal-style presets
├── commands.tsx        # the COMMANDS registry
├── executor.tsx        # parse + run a command line, pipes, game loop
├── store.ts            # zustand terminal state
└── components/         # Terminal, InputLine, Prompt, Picker, Chrome
```

Add a command in `src/commands.tsx`; add content in `src/lib/filesystem.ts`.

## 🔨 Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # -> ./build (static output)
```

## 📫 Contact

- Web: [matthewjmyrick.com](https://matthewjmyrick.com)
- Email: MatthewMyrick2@gmail.com
- LinkedIn: [linkedin.com/in/mattmyrick](https://www.linkedin.com/in/mattmyrick/)
- GitHub: [github.com/matthewmyrick](https://github.com/matthewmyrick)

---

_Built with ❤️ from my apartment in NYC. If the site's down, it's maintenance — or my cat found the power button. 🐱_
