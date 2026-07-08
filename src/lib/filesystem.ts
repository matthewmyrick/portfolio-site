// In-memory virtual filesystem. Files are markdown-ish plain text; the renderer
// (lib/render.tsx) adds color. Keeping content as plain text keeps `grep` simple.

export interface FileNode {
  type: 'file';
  content: string;
}
export interface DirNode {
  type: 'dir';
  children: Record<string, FsNode>;
}
export type FsNode = FileNode | DirNode;

const file = (content: string): FileNode => ({ type: 'file', content: content.replace(/^\n/, '') });
const dir = (children: Record<string, FsNode>): DirNode => ({ type: 'dir', children });

export const HOME = '/home/visitor';

const about = file(`
# About Me

There's no place like 127.0.0.1.

I'm Matthew — an infrastructure / platform engineer and SRE based in New York.
I'm currently the founding infrastructure lead at Hadrius AI (YC), where I run a
600+ node Kubernetes fleet, build the observability and deploy pipelines, and
keep things up at a 99.9% SLA.

I like terminals, automation, Postgres internals, and owning the whole stack —
literally. This site is self-hosted from my home lab: you're talking to a box in
my apartment right now.

When I'm not deep in YAML you'll find me on the basketball court or chasing waves
out at Rockaway Beach.
`);

const contact = file(`
# Contact

Location: New York, NY
Phone:    (408) 390-5085
Email:    MatthewMyrick2@gmail.com
LinkedIn: https://www.linkedin.com/in/mattmyrick/
GitHub:   https://github.com/matthewmyrick
Website:  https://matthewjmyrick.com (self-hosted from my home lab)
`);

const resume = file(`
# Matthew Myrick — Résumé

Infrastructure / Platform Engineer · SRE Lead · New York, NY

## Summary
Infrastructure & platform engineer specializing in large-scale Kubernetes,
observability, CI/CD, Postgres performance, and self-hosted systems. Currently
the founding infrastructure lead at Hadrius AI (YC).

## Navigate
- experience/   work history (hadrius-ai, anheuser-busch, capgemini)
- projects/     things I've built
- skills.md     languages & technologies
- education.md  schooling
- contact.md    get in touch

Want the real thing? Run 'open resume.pdf' to view the PDF in a new tab.
Tip: run 'ls -R' to see everything, or 'fzf' to fuzzy-find a file.
`);

// Binary placeholder — `open resume.pdf` opens the real PDF (served from /resume.pdf).
const resumePdf = file(`
[binary: PDF document]

This is my actual resume PDF. Run 'open resume.pdf' to view it in a new tab.
`);

const skills = file(`
# Skills

## Languages
Proficient:
- Terraform, Python, Go, Bash / Shell, JavaScript, SQL
Familiar:
- Zig, C, C#, Java

## Technologies
Proficient:
- Linux, Azure, AWS, Kubernetes, PostgreSQL
- GitHub Actions, Grafana stack, Datadog
- KEDA, Karpenter, Prefect, Procrastinate, Kafka, Tailscale
Familiar:
- GCP, OpenTelemetry, MongoDB
`);

const education = file(`
# Education

## Marquette University | Dec 2021
Milwaukee, WI

B.S. in Business Administration
Majors:
- Information Systems
- Finance
Minor:
- Computer Science
`);

const hadrius = file(`
# Hadrius AI (Y Combinator)

## Founding Lead Senior Infrastructure Engineer | Nov 2025 - Present
New York, NY

- Own the end-to-end infrastructure across a 600+ node / container fleet at a
  99.9% SLA; deep Postgres internals work (autovacuum tuning, RDS Proxy,
  connection lifecycle) for proactive performance tuning and stabilization.
- Engineered zero-downtime rolling deploys with HAProxy load balancing and
  blue/green API rollout + rollback on Kubernetes and ArgoCD.
- Migrated the worker fleet off AWS ASGs onto EKS with per-queue NodePools and
  KEDA + Karpenter autoscaling via declarative manifests — single-operator
  management at 600+ nodes.
- Architected large-scale AI classification pipelines on Kubernetes, migrating
  orchestration from Procrastinate to self-hosted Prefect for durable, autoscaled
  batch inference.
- Built a self-hosted Grafana + Loki + Alloy observability stack with an alert
  taxonomy routing events to Slack, Sentry, and CloudWatch.
- Built Go MCP servers for AI-assisted Sentry triage and alert investigation; led
  the Terraform IaC migration, EU / GDPR multi-region buildout, and SOC 2 / Vanta
  compliance.
`);

const anheuserBusch = file(`
# Anheuser-Busch

## Senior Platforms Engineer — SRE Lead | Feb 2023 - Nov 2025
New York, NY

- Led a team of 8 engineers driving SRE and platform reliability across the org.
- Enhanced the OTEL collector to channel APM metrics and logs into Datadog; built
  dashboards and alerts for full visibility into our services.
- Managed and supported Kubernetes across multiple environments, ensuring HA,
  scalable, secure containerized applications.

## Senior Platforms Engineer
- Refactored the docs website for centralized management with Docusaurus,
  Kubernetes, and SSO; presented it globally at a hackathon and took first place.
- Released a platforms API for remote management of sensitive env vars for our
  Swift iOS app, plus AuthN / AuthZ APIs using Azure AAD and B2C.

## Platforms Engineer
- Led migration of three services to IaC (Terraform), improving security and
  monitoring; set CI/CD best-practice standards and built automation for key
  monitoring, GitHub repos, and infrastructure.
`);

const capgemini = file(`
# Capgemini SE

## Software Engineer — NBCUniversal | Jan 2022 - Feb 2023
New York, NY

- Built and maintained an internal, production pricing application in .NET (C#)
  used by NBCUniversal business teams.
- Helped migrate CI/CD pipelines for 400+ applications from on-prem UBuild /
  UDeploy to GitHub Actions (Bash, PowerShell, Python, Java).
- Automated GitHub / TFS on-prem to cloud lift & shift of 4,500 repositories
  while preserving Git / TFS workflows.
`);

const projectsReadme = file(`
# Projects

Run 'cat projects/<name>.md' for details, or 'ls projects/'.

- azure-searcher.md  Azure resource explorer TUI (Go)
- catch-pokemon.md   Terminal Pokémon catching game (Rust / Go)
- portfolio-site.md  This site (React / TS / Vite)
`);

const azureSearcher = file(`
# azure-searcher — Azure Resource Explorer TUI

A Go terminal UI for browsing Azure resources with parallel goroutine fetching,
smart caching, and fast search.

https://github.com/matthewmyrick/azure-searcher
`);

const catchPokemon = file(`
# catch-pokemon — Terminal Pokémon Catching Game

A terminal Pokémon catching game (Rust / Go) with weighted encounters, animated
ASCII art, and cryptographically signed save storage.

https://github.com/matthewmyrick/catch-pokemon
`);

const portfolioSite = file(`
# portfolio-site — Interactive Terminal Portfolio

This site! A React / TypeScript / Vite terminal emulator over a virtual
filesystem, powering matthewjmyrick.com — self-hosted from my home lab.

https://github.com/matthewmyrick/portfolio-site
`);

// Hidden easter egg: shows under \`ls -la\`, but \`cat .env\` rickrolls you
// (the gif render is special-cased in commands.tsx — this content is a decoy).
const dotenv = file(`
# secrets — definitely do not commit
DATABASE_URL=postgres://admin:hunter2@localhost:5432/portfolio
API_KEY=sk-live-totally-real-key-please-dont-look
ADMIN_PASSWORD=correct-horse-battery-staple
`);

// Session shell config — actually parsed at session start and by `source`.
// Edit it in vim, `source ~/.bashrc`, and your aliases work for real.
const bashrc = file(`
# ~/.bashrc — applied at session start.
# Edit me (vim ~/.bashrc), then run: source ~/.bashrc

export EDITOR=vim
export LANG=en_US.UTF-8

alias ll='ls -la'
alias la='ls -a'
alias cls='clear'

# add your own:
# alias k='kubectl'
`);

// ---- guestbox — a second (entirely fictional) host you can `ssh` into -----

const guestMotd = file(`
Welcome to guestbox!

  A spare Raspberry Pi living in a closet. It does one job:
  making 'ssh guestbox' work on this site.

  uptime: 420 days (nobody dares reboot it)
`);

const guestTodo = file(`
# TODO (closet edition)

- [ ] figure out what guestbox actually does
- [ ] stop ssh-ing into prod to "just check something"
- [x] blink the LED
- [ ] dust
- [ ] give this Pi a real job (it has been "temporary" for 420 days)
`);

const guestFlag = file(`
flag{you_ssh_d_into_a_portfolio_site_and_ran_ls_-a_respect}

(There is no prize. But if you email me this flag, I will be impressed.)
`);

export const GUEST_ROOT: DirNode = dir({
  home: dir({
    visitor: dir({
      '.flag': guestFlag,
      motd: guestMotd,
      'TODO.txt': guestTodo
    })
  })
});

// Root tree. cwd starts at HOME (/home/visitor), displayed as ~.
export const ROOT: DirNode = dir({
  tmp: dir({}), // scratch space (kubectl edit drops manifests here)
  home: dir({
    visitor: dir({
      '.bashrc': bashrc,
      '.env': dotenv,
      'about.md': about,
      'contact.md': contact,
      'resume.md': resume,
      'resume.pdf': resumePdf,
      'skills.md': skills,
      'education.md': education,
      experience: dir({
        'hadrius-ai.md': hadrius,
        'anheuser-busch.md': anheuserBusch,
        'capgemini.md': capgemini
      }),
      projects: dir({
        'README.md': projectsReadme,
        'azure-searcher.md': azureSearcher,
        'catch-pokemon.md': catchPokemon,
        'portfolio-site.md': portfolioSite
      })
    })
  })
});
