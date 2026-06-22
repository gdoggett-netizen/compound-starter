# Canon — Compound Starter Curriculum

Domain charter for the compound-starter curriculum. Additive to the governing layer
(vault `CLAUDE.md` + vault `Canon.md`). If anything here conflicts with the vault,
the vault governs — flag the conflict rather than silently following this file.

This curriculum is modeled after Greg's own system and is taught to real people
(first Ben and Sam, with product potential beyond). These rules exist to keep the
learning experience engaging and friction-free, especially at the start, where people
are most likely to get frustrated and walk away before the vision becomes clear.

---

## Curriculum Rules

### 1. Free by default — paid is always optional, never a gate

Every layer must work end-to-end on a **free path** using tools the learner already has
(Cloudflare Workers AI, free GitHub, free Cloudflare Workers within daily limits). A
learner must never hit a step that **requires** spending money — no credit card, no paid
API key — in order to continue.

**Why:** A cost decision mid-flow is a hard stop. It makes the learner pause, leave the
tutorial, and lose momentum at the exact moment engagement matters most. We learned this
the hard way: Layer 1 originally required an Anthropic API key at the AI step, and it
stalled a learner mid-build. The free path keeps them moving.

**How to apply:** When building or editing any layer, the default route is the free one.
If a paid option genuinely produces a better result, present it as an **optional upgrade**
the learner can choose later — documented, never required. Run the free path through to a
working result before mentioning the paid alternative.

### 2. When the learner chooses free, tell them what the upgrade buys

At the moment a learner opts for the free path, explain — briefly and honestly — that
they're choosing a fully functional version and that a **higher-value upgrade exists** for
when they want it. They should understand the free choice is a real choice, not a
limitation they're stuck with. Frame the upgrade by what it improves (e.g. richer, more
synthesized writing), not by selling it. Free is the right call to start; the door stays open.

### 3. Resurface the upgrade at the right moment — not before

The upgrade prompt should come back **when it actually matters**, not at signup. Early on,
the brief is thin (the vault is nearly empty), and a free model is indistinguishable from a
paid one — so pushing an upgrade then is noise. As the system matures and the brief becomes
**more synthesized** — pulling across a fuller vault and ranked source signals — the quality
gap between the free model and a stronger one (Claude) becomes real and worth offering.

**Resurface point:** Layer 3 (Content Intelligence), where the brief begins synthesizing
across vault content and source scoring. The Layer 3 hand-off is where the upgrade is
re-offered, framed as: "your brief is now doing real synthesis — this is the point where
upgrading the model is worth it, if you want sharper output." Future layers that increase
synthesis quality are also valid resurface points.

**How to apply:** Don't repeat the upgrade pitch at every layer. Mention it once when the
learner first opts free (Rule 2), then resurface it once at the maturity point (Rule 3).
Twice total, both at moments that respect the learner's attention.

---

## Notes

- These rules govern the curriculum content (`content/Layer-*.md`) and how it's taught.
  They do not change how Greg's own pipelines operate — his system already handles cost its
  own way (budget-aware routing, Workers AI for cost-sensitive calls).
- This file is curriculum-maintainable. It is not one of the human-gated vault instruction
  files. Keep it current as the curriculum evolves.
