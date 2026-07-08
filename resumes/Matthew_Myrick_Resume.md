# Matthew Myrick

New York, NY 10003 | (408) 390-5085 | MatthewMyrick2@gmail.com
[linkedin.com/in/mattmyrick](https://www.linkedin.com/in/mattmyrick/) | [github.com/matthewmyrick](https://github.com/matthewmyrick) | [matthewjmyrick.com](https://matthewjmyrick.com) (self-hosted from home lab)

## Work Experience

### Hadrius AI (Y Combinator), New York, NY | Nov 2025 to Present
**Founding Lead Senior Site Reliability Engineer**
- As the sole infrastructure engineer at a Series A company, own the end-to-end stack across a 600+ node and container fleet, sustaining a 99.9% SLA uptime target; apply deep Postgres internals expertise (autovacuum tuning, RDS Proxy, connection lifecycle) for proactive performance tuning and stabilization.
- Engineered zero-downtime deployments with NGINX ingress controllers and HAProxy least-connections load balancing for the main web/API, plus blue/green rollout and rollback on Kubernetes and ArgoCD, eliminating deploy-driven outages and in-flight job loss.
- Migrated the entire worker fleet off AWS ASGs onto EKS with per-queue NodePools, KEDA and Karpenter autoscaling via declarative manifests, enabling per-queue scaling and single-operator management at 600+ nodes.
- Architected and operate large-scale AI classification job pipelines on Kubernetes, migrating orchestration from Procrastinate to self-hosted Prefect for durable, autoscaled batch inference across the worker fleet.
- Built and self-host a Grafana + Loki + Alloy observability stack with an alert taxonomy routing pod-level events to Slack, Sentry, and CloudWatch.
- Built internal and client-facing MCP servers in Go for AI-assisted Sentry triage and infrastructure alert investigation; led full Terraform IaC migration, multi-region EU/GDPR buildout, and SOC 2 / Vanta compliance.

### Anheuser-Busch, New York, NY | Feb 2023 to Nov 2025
**Senior Platforms Engineer, SRE Lead**
- Led a team of 8 engineers, driving SRE and platform reliability initiatives across the organization.
- Enhanced the OTEL collector service to channel APM metrics and logs into Datadog, and built dashboards and alerts for full visibility into our services.
- Managed, deployed, and supported Kubernetes across multiple environments, ensuring high availability, scalability, and security of containerized applications.

**Senior Platforms Engineer**
- Refactored the documentation website for centralized management with Docusaurus, Kubernetes, and SSO; presented the new web app to engineers globally at a hackathon, taking first place.
- Developed and released a platforms API service for remote management of sensitive environment variables for our Swift iOS mobile application, plus AuthN/AuthZ API services using Azure AAD and B2C for external and internal users.

**Platforms Engineer**
- Led migration of three services to Infrastructure as Code (Terraform), improving security and monitoring; implemented CI/CD best-practice standards across the organization and developed automation for key monitoring, GitHub repos, and infrastructure.

### Capgemini SE, New York, NY | Jan 2022 to Feb 2023
**Software Engineer, NBCUniversal**
- Built and maintained an internal, production pricing application in .NET (C#) used by NBCUniversal business teams.
- Assisted in migrating CI/CD pipelines for 400+ applications from on-prem UBuild/UDeploy to cloud GitHub Actions using Bash, PowerShell, Python, and Java.
- Automated GitHub/TFS on-prem to cloud lift & shift totaling 4,500 repositories while preserving Git/TFS workflows.

## Projects

- **azure-searcher**: Go terminal UI (TUI) for browsing Azure resources with parallel goroutine fetching, smart caching, and fast search.
- **catch-pokemon**: Terminal Pokémon catching game (Rust) with weighted encounters, animated ASCII art, and cryptographically signed save storage.
- **git-diffs**: Go terminal UI (TUI) for reviewing git diffs between branches with a GitHub-style side-by-side view, syntax highlighting, and fuzzy search.
- **portfolio-site**: Interactive terminal-style portfolio (React / TypeScript / Vite) powering matthewjmyrick.com, self-hosted from my home lab.

## Skills

**Languages** · Proficient: Terraform, Python, Go, Bash/Shell, JavaScript, SQL · Familiar: Zig, C, C#, Java
**Technologies** · Proficient: Linux, Azure, AWS, Kubernetes, PostgreSQL, NGINX, HAProxy, GitHub Actions, Grafana Stack, Datadog, KEDA, Karpenter, Prefect, Procrastinate, Kafka, Tailscale · Familiar: GCP, OTEL, MongoDB

## Education

### Marquette University, Milwaukee, WI | Dec 2021
B.S. in Business Administration: Majors in Information Systems, Finance & Minor in Computer Science
