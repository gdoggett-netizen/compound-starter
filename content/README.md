# Second Brain Curriculum

A layered system for building a personal AI infrastructure — from scratch, one working piece at a time.

Each layer ships something functional. You're not working toward a system — you have one at the end of every layer. Add layers when you're ready; stop whenever the system is useful enough.

---

## What you build

| Layer | What it is | What you walk away with |
|---|---|---|
| **0 — Vault** | A structured Obsidian notebook backed up to GitHub | A private note system that auto-syncs to the cloud every 15 minutes |
| **1 — Morning Brief** | A scheduled AI-written summary of your priorities | A daily brief in your vault every morning before you start work |
| **1.5 — Make It Yours** | Your governing layer: `Canon.md`, `CLAUDE.md`, `focus.md` | A system that follows *your* permanent rules automatically |
| **2 — RSS Flywheel** | A content pipeline that monitors sources you care about | A triage reader + nightly AI synthesis of what you kept |
| **3 — Content Intelligence** | A feedback loop that learns from your triage decisions | A ranked feed that gets smarter over time as you use it |
| **4 — Agent Swarm** | A task runner that dispatches work to an AI agent | A way to queue tasks from anywhere and find results in your vault |

Layers 0–3 are designed to be built in sequence. Layer 4 is optional and more technical — it's useful once the first three are running smoothly.

---

## How it works

Each layer is a **Builder Agent Prompt** — a Markdown file you paste into a Claude Code session. Claude interviews you one question at a time, learns your setup and preferences, then builds the system for you. You don't need to know how to code.

The interview is real — Claude uses your answers to personalize what it builds. A sales professional gets different folder structure and brief content than a researcher. A Mac-only user gets a different setup than someone who also uses a Windows work machine.

**To start any layer:**
1. Open Terminal on your Mac
2. Run `claude` (Claude Code)
3. Paste the contents of the layer file
4. Answer the questions

---

## Prerequisites

**For Layer 0 (Vault):**
- A Mac
- [Obsidian](https://obsidian.md) (free)
- A [GitHub](https://github.com) account (free)
- [Homebrew](https://brew.sh) (free) — most Macs already have it

**For Layers 1–3:**
- Layer 0 complete
- A [Cloudflare](https://cloudflare.com) account (free tier)
- Node.js (installed via Homebrew if not already present)

No paid API key is required. The AI work runs free on Cloudflare Workers AI. An optional Claude upgrade is available later if you want sharper output — the curriculum points it out at the moment it actually matters.

**For Layer 4:**
- Layers 0–3 complete
- Claude Code installed and authenticated on your Mac

---

## Cost

| Layer | Monthly cost |
|---|---|
| 0 — Vault | Free |
| 1 — Morning Brief | Free (Cloudflare Workers AI) |
| 1.5 — Make It Yours | Free |
| 2 — RSS Flywheel | Free (Cloudflare Workers AI) |
| 3 — Content Intelligence | No additional cost |
| 4 — Agent Swarm | Depends on task volume and complexity |

Cloudflare Workers, Pages, and Workers AI are free up to generous limits — for personal use, you won't hit them. If you later choose to upgrade the morning brief to Claude for higher-quality writing (optional, surfaced in Layer 3), that adds roughly $1–3/month in Anthropic API usage.

---

## Time investment

| Layer | First session | Ongoing |
|---|---|---|
| 0 — Vault | 30–60 min | ~0 (auto-syncs) |
| 1 — Morning Brief | 20–40 min | 2 min/day to read it |
| 1.5 — Make It Yours | ~15 min | ~0 (edit Canon as rules emerge) |
| 2 — RSS Flywheel | 45–60 min | 5–10 min/day to triage |
| 3 — Content Intelligence | 20–30 min | ~0 (passive) |
| 4 — Agent Swarm | 45–90 min | Varies by task volume |

---

## Design philosophy

**Functional at every layer.** No layer is a stepping stone to the next. If you stop at Layer 2, you have a complete, useful system — a vault, a morning brief, and a content pipeline. Each layer adds value independently.

**Interview-driven.** Claude builds *your* system, not a generic template. Your folder structure, brief tone, feed sources, and task templates reflect what you told it. The same prompts build a different system for different people.

**Ownership.** Everything runs on infrastructure you control: your GitHub repo, your Cloudflare account, your API keys. Nothing goes through a third-party service that can change pricing, shut down, or lock you out.

**Mac-first.** Shell scripts and LaunchAgents are Mac-specific. Steps marked `[Mac only]` have no Windows equivalent in this curriculum — but your vault is accessible from any machine via Obsidian + GitHub.

---

## Files

```
Curriculum/
  README.md               — this file
  Layer-0-Vault-Setup.md  — Builder Agent Prompt: vault
  Layer-1-Morning-Brief.md — Builder Agent Prompt: morning brief
  Layer-1.5-Make-It-Yours.md — Builder Agent Prompt: governing layer (Canon)
  Layer-2-RSS-Flywheel.md — Builder Agent Prompt: RSS pipeline + reader
  Layer-3-Content-Intelligence.md — Builder Agent Prompt: source scoring
  Layer-4-Agent-Swarm.md  — Builder Agent Prompt: task runner (optional)
```

---

## Start here

**First, read [Start Here — Why This Works](orientation.html).** It's a five-minute orientation that explains what you're building and why, so the steps actually make sense instead of feeling like stabbing in the dark. Don't skip it.

Then open your terminal and run:

```bash
claude
```

and paste the contents of `Layer-0-Vault-Setup.md`.
