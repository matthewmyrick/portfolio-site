#!/usr/bin/env python3
"""Build a minimal, small .docx with full formatting (no python-docx template bloat)."""
import zipfile, os
from xml.sax.saxutils import escape

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
ACCENT = "1F3A5F"
YC = "555555"

paras = []

def run(text, bold=False, italic=False, sz=19, color=None):
    rpr = "<w:rPr>"
    if bold: rpr += "<w:b/>"
    if italic: rpr += "<w:i/>"
    if color: rpr += f'<w:color w:val="{color}"/>'
    rpr += f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/></w:rPr>'
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'

def para(runs, align=None, before=0, after=0, ind_left=0, hang=0, tabs=None, border=False):
    ppr = "<w:pPr>"
    ppr += f'<w:spacing w:before="{before}" w:after="{after}" w:line="240" w:lineRule="auto"/>'
    if align: ppr += f'<w:jc w:val="{align}"/>'
    if ind_left or hang: ppr += f'<w:ind w:left="{ind_left}" w:hanging="{hang}"/>'
    if tabs:
        ts = "".join(f'<w:tab w:val="{v}" w:pos="{p}"/>' for v, p in tabs)
        ppr += f"<w:tabs>{ts}</w:tabs>"
    if border:
        ppr += f'<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="{ACCENT}"/></w:pBdr>'
    ppr += "</w:pPr>"
    paras.append(f"<w:p>{ppr}{''.join(runs)}</w:p>")

RIGHT_TAB = 10560  # ~7.33in twips

def section(title):
    para([run(title.upper(), bold=True, sz=20, color=ACCENT)], before=110, after=20, border=True)

def job(company, location, dates, yc=False):
    runs = [run(company, bold=True, sz=20)]
    if yc:
        runs.append(run("  (Y Combinator)", bold=False, sz=17, color=YC))
    runs.append(run("   " + location, sz=18))
    runs.append(run("\t" + dates, bold=True, sz=18))
    para(runs, before=55, after=0, tabs=[("right", RIGHT_TAB)])

def role(title):
    para([run(title, bold=True, italic=True, sz=18)], after=0)

def bullet(*segs):
    runs = [run("•  ", sz=18)] + [run(t, bold=b, italic=i, sz=18) for (t, b, i) in segs]
    para(runs, after=20, ind_left=250, hang=180)

def line(text):
    para([run(text, sz=18)], after=0)

# Header
para([run("Matthew Myrick", bold=True, sz=42, color=ACCENT)], align="center", after=20)
para([run("New York, NY 10003   |   (408) 390-5085   |   MatthewMyrick2@gmail.com", sz=18)], align="center", after=0)
para([run("linkedin.com/in/mattmyrick   |   github.com/matthewmyrick   |   matthewjmyrick.com (self-hosted from home lab)", sz=18)], align="center", after=0)

# Work Experience
section("Work Experience")
job("Hadrius AI", "New York, NY", "Nov 2025 to Present", yc=True)
role("Founding Lead Senior Site Reliability Engineer")
bullet(("As the sole infrastructure engineer at a Series A company, own the end-to-end stack across a 600+ node and container fleet, sustaining a 99.9% SLA uptime target; apply deep Postgres internals expertise (autovacuum tuning, RDS Proxy, connection lifecycle) for proactive performance tuning and stabilization.", False, False))
bullet(("Engineered zero-downtime deployments with NGINX ingress controllers and HAProxy least-connections load balancing for the main web/API, plus blue/green rollout and rollback on Kubernetes and ArgoCD, eliminating deploy-driven outages and in-flight job loss.", False, False))
bullet(("Migrated the entire worker fleet off AWS ASGs onto EKS with per-queue NodePools, KEDA and Karpenter autoscaling via declarative manifests, enabling per-queue scaling and single-operator management at 600+ nodes.", False, False))
bullet(("Architected and operate large-scale AI classification job pipelines on Kubernetes, migrating orchestration from Procrastinate to self-hosted Prefect for durable, autoscaled batch inference across the worker fleet.", False, False))
bullet(("Built and self-host a Grafana + Loki + Alloy observability stack with an alert taxonomy routing pod-level events to Slack, Sentry, and CloudWatch.", False, False))
bullet(("Built internal and client-facing MCP servers in Go for AI-assisted Sentry triage and infrastructure alert investigation; led full Terraform IaC migration, multi-region EU/GDPR buildout, and SOC 2 / Vanta compliance.", False, False))

job("Anheuser-Busch", "New York, NY", "Feb 2023 to Nov 2025")
role("Senior Platforms Engineer, SRE Lead")
bullet(("Led a team of 8 engineers, driving SRE and platform reliability initiatives across the organization.", False, False))
bullet(("Enhanced the OTEL collector service to channel APM metrics and logs into Datadog, and built dashboards and alerts for full visibility into our services.", False, False))
bullet(("Managed, deployed, and supported Kubernetes across multiple environments, ensuring high availability, scalability, and security of containerized applications.", False, False))
role("Senior Platforms Engineer")
bullet(("Refactored the documentation website for centralized management with Docusaurus, Kubernetes, and SSO; presented the new web app to engineers globally at a hackathon, taking first place.", False, False))
bullet(("Developed and released a platforms API service for remote management of sensitive environment variables for our Swift iOS mobile application, plus AuthN/AuthZ API services using Azure AAD and B2C for external and internal users.", False, False))
role("Platforms Engineer")
bullet(("Led migration of three services to Infrastructure as Code (Terraform), improving security and monitoring; implemented CI/CD best-practice standards across the organization and developed automation for key monitoring, GitHub repos, and infrastructure.", False, False))

job("Capgemini SE", "New York, NY", "Jan 2022 to Feb 2023")
role("Software Engineer, NBCUniversal")
bullet(("Built and maintained an internal, production pricing application in .NET (C#) used by NBCUniversal business teams.", False, False))
bullet(("Assisted in migrating CI/CD pipelines for 400+ applications from on-prem UBuild/UDeploy to cloud GitHub Actions using Bash, PowerShell, Python, and Java.", False, False))
bullet(("Automated GitHub/TFS on-prem to cloud lift & shift totaling 4,500 repositories while preserving Git/TFS workflows.", False, False))

# Projects
section("Projects")
bullet(("azure-searcher", True, True), (": Go terminal UI (TUI) for browsing Azure resources with parallel goroutine fetching, smart caching, and fast search.", False, False))
bullet(("catch-pokemon", True, True), (": Terminal Pokémon catching game (Rust) with weighted encounters, animated ASCII art, and cryptographically signed save storage.", False, False))
bullet(("git-diffs", True, True), (": Go terminal UI (TUI) for reviewing git diffs between branches with a GitHub-style side-by-side view, syntax highlighting, and fuzzy search.", False, False))
bullet(("portfolio-site", True, True), (": Interactive terminal-style portfolio (React / TypeScript / Vite) powering matthewjmyrick.com, self-hosted from my home lab.", False, False))

# Skills
section("Skills")
para([run("Languages", bold=True, sz=18), run("   Proficient: ", bold=True, sz=18), run("Terraform, Python, Go, Bash/Shell, JavaScript, SQL", sz=18), run("    Familiar: ", bold=True, sz=18), run("Zig, C, C#, Java", sz=18)], after=20)
para([run("Technologies", bold=True, sz=18), run("   Proficient: ", bold=True, sz=18), run("Linux, Azure, AWS, Kubernetes, PostgreSQL, NGINX, HAProxy, GitHub Actions, Grafana Stack, Datadog, KEDA, Karpenter, Prefect, Procrastinate, Kafka, Tailscale", sz=18), run("    Familiar: ", bold=True, sz=18), run("GCP, OTEL, MongoDB", sz=18)], after=20)

# Education
section("Education")
job("Marquette University", "Milwaukee, WI", "Dec 2021")
line("B.S. in Business Administration: Majors in Information Systems, Finance & Minor in Computer Science")

sectpr = ('<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
          '<w:pgMar w:top="540" w:right="792" w:bottom="540" w:left="792" '
          'w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>')

document_xml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<w:document xmlns:w="{W}"><w:body>' + "".join(paras) + sectpr + '</w:body></w:document>')

content_types = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')

rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')

out = "/Users/matthewmyrick/Matthew_Myrick_Resume.docx"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", document_xml)
print("docx bytes:", os.path.getsize(out))
