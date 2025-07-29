# 🖥️ Terminal Portfolio Site

> *"There's no place like 127.0.0.1"* 🏠

Welcome to my interactive terminal-style portfolio! This isn't your average portfolio website - it's a fully functional terminal emulator built with SvelteKit that you can interact with using actual commands.

## 🚀 What Makes This Special

This portfolio is **self-hosted from my apartment** using my own server setup! That's right - when you visit my site, you're literally connecting to hardware sitting in my living room. No fancy cloud providers, just good old-fashioned home hosting with KubeSail.

## 🔧 How It Works

Built with modern web tech that makes the terminal experience smooth and authentic:

- **SvelteKit** - For that buttery smooth reactivity
- **TypeScript** - Because types are friends, not food
- **TailwindCSS** - Making things pretty without the headache
- **Docker + Nginx** - Containerized and ready to serve

### Terminal Features

Type `help` to see all available commands, but here's what you can do:

- 📋 `about` - Learn about me and my home server setup
- 💼 `experience` - Browse through my work history
- 🛠️ `skills` - Check out my technical skills
- 📁 `projects` - Explore my recent projects
- 📧 `contact` - Get in touch with me
- 💃 `dance-battle` - Challenge me to a dance-off (seriously!)
- 🎮 `game` - Play a number guessing game
- 🧹 `clear` - Clean up the terminal

## 🏗️ Architecture

```
portfolio-web/
├── src/
│   ├── commands/           # All terminal commands and their content
│   ├── lib/
│   │   ├── components/     # Svelte components
│   │   ├── stores/         # Terminal state management
│   │   └── utils/          # Command processing logic
│   └── routes/             # SvelteKit routing
├── Dockerfile              # Container setup
└── nginx.conf             # Web server config
```

The magic happens in the command processing system - each command has its own content file, and the terminal emulator handles parsing, highlighting, and execution with full keyboard navigation support.

## 🏡 Self-Hosted Pride

This site runs on my own hardware because:
- I believe in owning your digital presence
- It's more fun to troubleshoot at 2 AM when something breaks
- My neighbors get to hear my server fans when I deploy updates
- True full-stack means managing the actual stack

## 🎯 Try It Out

Visit the site and start typing! The terminal supports:
- ⌨️ Full keyboard navigation
- 📝 Command history (up/down arrows)
- 🎨 Syntax highlighting
- 🖱️ Click to focus
- 📱 Mobile-friendly terminal experience

## 🔨 Development

```bash
npm install
npm run dev
```

The site auto-rebuilds and hot-reloads as you make changes. Perfect for adding new commands or tweaking the terminal experience.

---

*Built with ❤️ (and occasional frustration) from my apartment in NYC*

**Fun fact**: If this site is down, it might be because I'm doing maintenance, or my cat decided the power button looked particularly pushable today. 🐱