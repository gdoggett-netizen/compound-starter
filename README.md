# compound-starter

> The **teachable version** of Greg's system — a free-path curriculum that walks a newcomer from an empty vault to a working second-brain-plus-agents, layer by layer. First students: Ben and Sam; product potential beyond.

**Status:** Active · **Type:** Cloudflare Pages (curriculum site) · **Lane:** personal / product · **Live:** `compound-starter.pages.dev` · **Deploy:** CI on push to main (`deploy.yml` → build `dist` → Pages)

## Place in the system

This repo answers to the vault **`Canon.md` + `CLAUDE.md`** (master) and carries its **own repo charter** — [`Canon.md`](Canon.md) (the curriculum's domain rules: free-by-default, optional paid upgrade). Per the governance layering, the repo `Canon.md` is *additive* and never overrides the vault silently. This is the **Compound Starter** track — the generalized, friend-shareable rendering of the Framework, modeled on Greg's own live system. System map: vault `Projects/The Compound — Master App Plan.md`.

## How it runs

Curriculum content lives in `content/` (`Layer-*.md`); `build.js` renders it to `dist/`, and CI publishes `dist` to Pages on push to main. The site homepage is built from **`content/README.md`** — *not this file*. This README is the repo's front door; `content/README.md` is the published site index. Don't edit one expecting to change the other.

---

*Follows the repo-level documentation standard (vault `Projects/Documentation Standard.md`, lite tier). Repo charter: [`Canon.md`](Canon.md).*
