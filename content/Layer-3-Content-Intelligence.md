# Layer 3 — Content Intelligence
## Builder Agent Prompt

**How to use this:** Paste the contents of this file into a Claude Code session on your Mac. Claude will interview you, then upgrade your RSS flywheel from Layer 2 so that your own decisions — keep, save, skip, reject — feed back into the system and make the feed smarter over time. Every action teaches the system what's worth your attention. You need Layers 0, 1, and 2 complete before starting this.

---

You are adding a feedback loop to a content system that already runs. The person has an RSS flywheel from Layer 2 that polls feeds, shows them a triage queue, and writes a nightly brief. What's missing: the system doesn't remember what they liked or disliked. Every day the feed is in the same random order. Layer 3 fixes that.

The goal is to close the loop. Their triage decisions from Layer 2 are already stored in a `decisions` table — this layer reads them and uses them to score sources, rank the feed, and surface intelligence about their information diet.

**Interview protocol:** Ask questions ONE AT A TIME. Wait for each answer before asking the next. Do not start building until the interview is complete. This layer touches existing code — read what's already there before editing anything.

**Tone:** Analytical and reflective. This is about making the system earn the person's attention. The conversation should feel like understanding what they value, not just configuring a tool.

---

## Interview

### Q1 — System check

Open with:

> "Let's make sure your RSS flywheel from Layer 2 has been running. Can you open the reader and tell me roughly how many items you've triaged since you set it up? Even a ballpark is fine."

- **Less than ~20 decisions total:** "The scoring in Layer 3 works best with a little more history. Keep using the reader for a few more days, then come back — scoring with almost no data will feel flat since all sources start at 0.5. That said, we can still set it up now and it'll improve as you triage."
- **20+ decisions:** "Good — there's enough signal to work with. Let's build."

Read the existing project at `~/[worker-name]-rss/src/index.js` before touching anything. The upgrade adds new functions and replaces specific existing ones — you need to know what's already there.

---

### Q2 — What do you want from this

> "Right now the reader shows items in the order they arrived — newest first, regardless of source. Layer 3 changes that. Items from sources you've consistently kept will float to the top. Items from sources you've consistently rejected will sink.
>
> Beyond ranking, what else would be useful? A few options:
> - See a breakdown of your source scores (which sources you like most)
> - Have the nightly brief include insights about your reading patterns
> - Surface your top sources in your morning brief from Layer 1
>
> Which of these feel worth adding?"

Their answer determines which optional sections to build. The core (ranked feed + scores view) is always included. The morning brief connection is optional.

---

### Q3 — Morning brief connection

> "Do you want your top-performing sources mentioned in your morning brief — something like 'your most trusted sources are [X, Y, Z]'? It's a small addition to Layer 1's worker."

- **Yes:** you'll add a step to pass top-source context to the Layer 1 morning brief
- **No:** skip that section

---

## Confirm before building

Summarize:

> "Here's what I'm going to add:
> - **Ranked feed:** items from your best sources appear first, based on your decision history
> - **Source scores view:** a tab in the reader showing each source's score and your decision breakdown
> - **Nightly brief upgrade:** includes top and underperforming sources each night
> [If yes to Q3:] - **Morning brief connection:** your top 3 sources added to Layer 1's context
>
> I'll read your existing Layer 2 code first, then make targeted additions — nothing built in Layer 2 gets removed.
>
> Ready?"

Wait for a yes.

---

## Build

Read the existing `src/index.js` before making any changes. Identify: where `handleGetItems` is defined, where `generateNightlyBrief` is defined, and where the route table is in the `fetch` handler. This tells you exactly where to make each change.

---

### Step 1 — Add the scoring module

Create a new file `src/scoring.js`. This is the only new file — everything else is additions to the existing worker.

```javascript
// scoring.js — computes source quality scores from decision history.
//
// Each action has a weight: save and keep are positive signals,
// reject and skip are negative. Additive smoothing (PRIOR) keeps
// low-signal sources near neutral (0.5) rather than swinging to
// extremes on one or two clicks.

export const POS_W  = { keep: 1.0, save: 2.0 };
export const NEG_W  = { skip: 0.5, reject: 2.0 };
export const NEUTRAL = 0.5;
export const PRIOR   = 4;  // pseudo-decisions of neutral evidence

// Build a { source → score } map from the DB.
// rows: [{ source, keeps, saves, skips, rejects }]
export function computeScores(rows) {
  const scores = {};
  for (const row of rows ?? []) {
    if (!row?.source) continue;
    const pos   = (Number(row.keeps)   || 0) * POS_W.keep
                + (Number(row.saves)   || 0) * POS_W.save;
    const neg   = (Number(row.skips)   || 0) * NEG_W.skip
                + (Number(row.rejects) || 0) * NEG_W.reject;
    const total = pos + neg;
    scores[row.source] = (pos + NEUTRAL * PRIOR) / (total + PRIOR);
  }
  return scores;
}

// Score a single item. Unknown source → neutral prior.
export function scoreItem(source, scores) {
  return scores[source] ?? NEUTRAL;
}
```

---

### Step 2 — Add the scores query

Add this function to `src/index.js` (near the other handler functions). It reads the decisions table and returns one row per source with action tallies.

```javascript
import { computeScores, scoreItem, NEUTRAL } from './scoring.js';

async function getSourceScores(env) {
  // All-time decisions, grouped by source
  const result = await env.DB.prepare(`
    SELECT c.source,
      SUM(CASE WHEN d.action = 'keep'   THEN 1 ELSE 0 END) AS keeps,
      SUM(CASE WHEN d.action = 'save'   THEN 1 ELSE 0 END) AS saves,
      SUM(CASE WHEN d.action = 'skip'   THEN 1 ELSE 0 END) AS skips,
      SUM(CASE WHEN d.action = 'reject' THEN 1 ELSE 0 END) AS rejects
    FROM decisions d
    JOIN captures c ON c.id = d.capture_id
    GROUP BY c.source
  `).all();
  return computeScores(result.results ?? []);
}
```

Add the import at the top of `index.js`. If the file currently has no imports, add it as the first line.

---

### Step 3 — Update handleGetItems to rank by score

Replace the existing `handleGetItems` function with this version. The only change is: items are now sorted by source score (desc), then by recency as a tiebreaker.

```javascript
async function handleGetItems(url, env) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

  const [itemsResult, scores] = await Promise.all([
    env.DB.prepare(
      'SELECT id, title, url, source, captured_at FROM captures WHERE kept_at IS NULL AND rejected_at IS NULL ORDER BY captured_at DESC LIMIT ?'
    ).bind(limit).all(),
    getSourceScores(env)
  ]);

  const items = (itemsResult.results ?? [])
    .map(item => ({ ...item, score: scoreItem(item.source, scores) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.captured_at).localeCompare(String(a.captured_at));
    });

  return Response.json({ items });
}
```

---

### Step 4 — Add the /api/scores endpoint

Add this handler function to `src/index.js`:

```javascript
async function handleGetScores(env) {
  const result = await env.DB.prepare(`
    SELECT c.source,
      SUM(CASE WHEN d.action = 'keep'   THEN 1 ELSE 0 END) AS keeps,
      SUM(CASE WHEN d.action = 'save'   THEN 1 ELSE 0 END) AS saves,
      SUM(CASE WHEN d.action = 'skip'   THEN 1 ELSE 0 END) AS skips,
      SUM(CASE WHEN d.action = 'reject' THEN 1 ELSE 0 END) AS rejects,
      COUNT(*) AS total
    FROM decisions d
    JOIN captures c ON c.id = d.capture_id
    GROUP BY c.source
    ORDER BY total DESC
  `).all();

  const rows = result.results ?? [];
  const scores = computeScores(rows);

  const sources = rows.map(row => ({
    source: row.source,
    score:  Math.round(scores[row.source] * 100) / 100,
    keeps:  Number(row.keeps),
    saves:  Number(row.saves),
    skips:  Number(row.skips),
    rejects: Number(row.rejects),
    total:  Number(row.total)
  })).sort((a, b) => b.score - a.score);

  return Response.json({ sources });
}
```

Then add it to the route table in the `fetch` handler, alongside the existing routes:

```javascript
if (pathname === '/api/scores') return handleGetScores(env);
```

---

### Step 5 — Update the reader HTML

Replace the `READER_HTML` constant in `src/index.js` with this version. It adds a Sources tab showing score breakdowns, and the feed now reflects the ranked order from the updated `handleGetItems`.

```javascript
const READER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>[Name]'s Reader</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  .header { padding: 14px 20px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 16px; }
  .header h1 { font-size: 15px; font-weight: 600; color: #f1f5f9; }
  .tabs { display: flex; gap: 4px; margin-left: auto; }
  .tab { padding: 5px 12px; border-radius: 5px; border: none; background: transparent; color: #64748b; font-size: 13px; cursor: pointer; }
  .tab.active { background: #1e293b; color: #f1f5f9; }
  .count { font-size: 13px; color: #64748b; }
  .pane { display: none; }
  .pane.active { display: block; }

  /* Feed */
  .feed { max-width: 680px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .card { background: #1e293b; border-radius: 8px; padding: 14px 16px; }
  .card-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .card-source { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .score-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .card-title { font-size: 15px; font-weight: 500; color: #f1f5f9; line-height: 1.4; margin-bottom: 10px; }
  .card-title a { color: inherit; text-decoration: none; }
  .card-title a:hover { color: #38bdf8; }
  .card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn { padding: 5px 14px; border-radius: 5px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: opacity 0.15s; }
  .btn:hover { opacity: 0.8; }
  .btn-keep   { background: #166534; color: #86efac; }
  .btn-save   { background: #1e3a8a; color: #93c5fd; }
  .btn-skip   { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
  .btn-reject { background: #7f1d1d; color: #fca5a5; }

  /* Sources */
  .sources { max-width: 680px; margin: 0 auto; padding: 16px; }
  .source-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .source-table th { text-align: left; color: #64748b; font-weight: 500; padding: 8px 10px; border-bottom: 1px solid #1e293b; }
  .source-table td { padding: 10px; border-bottom: 1px solid #1e293b; color: #e2e8f0; vertical-align: middle; }
  .source-table tr:last-child td { border-bottom: none; }
  .bar-wrap { width: 80px; background: #1e293b; border-radius: 3px; height: 6px; display: inline-block; vertical-align: middle; }
  .bar-fill { height: 6px; border-radius: 3px; }
  .score-label { font-weight: 600; font-size: 12px; min-width: 34px; display: inline-block; text-align: right; margin-right: 8px; }

  .empty { text-align: center; color: #475569; padding: 60px 20px; font-size: 15px; }
  .loading { text-align: center; color: #475569; padding: 40px; }
</style>
</head>
<body>
<div class="header">
  <h1>[Name]'s Reader</h1>
  <span class="count" id="count"></span>
  <div class="tabs">
    <button class="tab active" onclick="showTab('feed')">Feed</button>
    <button class="tab" onclick="showTab('sources')">Sources</button>
  </div>
</div>

<div id="pane-feed" class="pane active">
  <div class="feed" id="feed"><div class="loading">Loading...</div></div>
</div>
<div id="pane-sources" class="pane">
  <div class="sources" id="sources"><div class="loading">Loading...</div></div>
</div>

<script>
let items = [], activeTab = 'feed';

function scoreColor(s) {
  if (s >= 0.65) return '#22c55e';
  if (s >= 0.45) return '#f59e0b';
  return '#ef4444';
}

function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('pane-' + tab).classList.add('active');
  if (tab === 'sources') loadSources();
}

async function load() {
  const res = await fetch('/api/items?limit=100');
  const data = await res.json();
  items = data.items || [];
  document.getElementById('count').textContent = items.length + ' items';
  renderFeed();
}

function renderFeed() {
  const feed = document.getElementById('feed');
  if (!items.length) { feed.innerHTML = '<div class="empty">All caught up.</div>'; return; }
  feed.innerHTML = items.map(i => \`
    <div class="card" id="c-\${i.id}">
      <div class="card-meta">
        <span class="score-dot" style="background:\${scoreColor(i.score || 0.5)}"></span>
        <span class="card-source">\${i.source}</span>
      </div>
      <div class="card-title"><a href="\${i.url}" target="_blank" rel="noopener">\${i.title}</a></div>
      <div class="card-actions">
        <button class="btn btn-keep"   onclick="decide('\${i.id}','keep')">Keep</button>
        <button class="btn btn-save"   onclick="decide('\${i.id}','save')">Save</button>
        <button class="btn btn-skip"   onclick="decide('\${i.id}','skip')">Skip</button>
        <button class="btn btn-reject" onclick="decide('\${i.id}','reject')">Reject</button>
      </div>
    </div>
  \`).join('');
}

async function decide(id, action) {
  const card = document.getElementById('c-' + id);
  if (card) card.style.opacity = '0.3';
  await fetch('/api/items/' + id + '/' + action, { method: 'POST' });
  items = items.filter(i => i.id !== id);
  document.getElementById('count').textContent = items.length + ' items';
  renderFeed();
}

async function loadSources() {
  const src = document.getElementById('sources');
  const res = await fetch('/api/scores');
  const data = await res.json();
  const rows = data.sources || [];
  if (!rows.length) { src.innerHTML = '<div class="empty">No decisions yet — triage some items first.</div>'; return; }
  src.innerHTML = \`<table class="source-table">
    <thead><tr><th>Source</th><th>Score</th><th>Decisions</th></tr></thead>
    <tbody>\${rows.map(r => \`
      <tr>
        <td>\${r.source}</td>
        <td>
          <span class="score-label" style="color:\${scoreColor(r.score)}">\${(r.score*100).toFixed(0)}%</span>
          <span class="bar-wrap"><span class="bar-fill" style="width:\${r.score*100}%;background:\${scoreColor(r.score)}"></span></span>
        </td>
        <td style="color:#64748b">\${r.total} (\${r.keeps}k \${r.saves}s \${r.skips}sk \${r.rejects}r)</td>
      </tr>
    \`).join('')}</tbody>
  </table>\`;
}

load();
</script>
</body>
</html>`;
```

Fill in both `[Name]` placeholders before saving.

---

### Step 6 — Update the nightly brief to include source insights

Replace the existing `generateNightlyBrief` function with this version. It adds a source intelligence section at the bottom of each brief.

```javascript
async function generateNightlyBrief(env) {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [keptResult, scoresResult] = await Promise.all([
    env.DB.prepare(
      'SELECT c.title, c.url, c.source FROM captures c WHERE c.kept_at > ? ORDER BY c.kept_at DESC'
    ).bind(since).all(),
    env.DB.prepare(`
      SELECT c.source,
        SUM(CASE WHEN d.action = 'keep'   THEN 1 ELSE 0 END) AS keeps,
        SUM(CASE WHEN d.action = 'save'   THEN 1 ELSE 0 END) AS saves,
        SUM(CASE WHEN d.action = 'skip'   THEN 1 ELSE 0 END) AS skips,
        SUM(CASE WHEN d.action = 'reject' THEN 1 ELSE 0 END) AS rejects,
        COUNT(*) AS total
      FROM decisions d JOIN captures c ON c.id = d.capture_id
      GROUP BY c.source HAVING total >= 5
    `).all()
  ]);

  const kept = keptResult.results ?? [];
  if (!kept.length) { console.log('Nothing kept today.'); return; }

  const itemList = kept.map(i => `- [${i.source}] ${i.title}\n  ${i.url}`).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: env.BRIEF_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Today is ${today}. Here is the content I kept:\n\n${itemList}\n\nWrite the nightly brief.` }]
    })
  });

  if (!res.ok) { console.error('Anthropic error:', res.status); return; }
  const data = await res.json();
  const brief = data.content[0].text;

  // Source intelligence section
  const scores = computeScores(scoresResult.results ?? []);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top    = ranked.slice(0, 3).map(([s, sc]) => `${s} (${(sc * 100).toFixed(0)}%)`).join(', ');
  const bottom = ranked.slice(-3).reverse().map(([s, sc]) => `${s} (${(sc * 100).toFixed(0)}%)`).join(', ');
  const intel  = ranked.length >= 3
    ? `\n**Source signals:** Top — ${top} · Lowest — ${bottom}`
    : '';

  const content = `# Content Brief — ${today}\n\n${brief}${intel}\n\n---\n\n## Kept today\n\n${itemList}\n`;
  if (env.GITHUB_TOKEN && env.GITHUB_REPO) {
    await writeToVault(content, `Agent Outputs/[RSS] ${today}.md`, env);
  }
}
```

Add the `computeScores` import at the top of this function's scope (it's already imported from `scoring.js` after Step 2).

---

### Step 7 — Deploy

```bash
cd ~/[worker-name]-rss
wrangler deploy
```

No new secrets needed — everything uses the existing bindings and secrets from Layer 2.

---

### Step 8 — (Optional) Connect to Layer 1 morning brief

If they said yes in Q3, add their top sources to the morning brief context. In the Layer 1 worker project (`~/[worker-name]-morning-brief/src/index.js`), add a call to the Layer 2 worker's `/api/scores` endpoint and include the top sources in the vault context:

```javascript
// Add to readVaultContext() in the Layer 1 worker, after fetching vault files
async function readSourceContext(env) {
  if (!env.RSS_WORKER_URL) return '';
  try {
    const res = await fetch(`${env.RSS_WORKER_URL}/api/scores`);
    if (!res.ok) return '';
    const data = await res.json();
    const top = (data.sources || []).slice(0, 5);
    if (!top.length) return '';
    const list = top.map(s => `- ${s.source} (score: ${(s.score * 100).toFixed(0)}%)`).join('\n');
    return `## Top content sources\n\n${list}`;
  } catch { return ''; }
}
```

Then in `readVaultContext`, add:
```javascript
const sourceContext = await readSourceContext(env);
if (sourceContext) sections.push(sourceContext);
```

Set a new secret in the Layer 1 worker:
```bash
cd ~/[worker-name]-morning-brief
wrangler secret put RSS_WORKER_URL
# type: https://[worker-name]-rss.[subdomain].workers.dev
```

Redeploy Layer 1:
```bash
wrangler deploy
```

---

## Verify

1. **Open the reader** — items should appear in a different order than before (high-score sources first). Each card has a colored dot: green = trusted source, yellow = neutral, red = declining signal.
2. **Sources tab** — click Sources, confirm source table loads with scores and decision breakdowns.
3. **Triage a few items** — keep some from one source, reject some from another. Refresh the reader — the feed order should shift.
4. **Trigger the nightly brief** — `curl .../trigger/brief`. Check the vault: the brief should include a "Source signals" line at the bottom.
5. **(If Layer 1 connected)** — trigger the morning brief and confirm top sources appear in the context.

---

## Hand off

End with:

> "Your feed is now intelligent. Here's what changed:
>
> - **Ranked feed:** sources you trust appear first. New or untested sources start in the middle, neither boosted nor penalized.
> - **Sources tab:** open it any time to see which sources are earning your attention and which aren't.
> - **Nightly brief:** now includes a source signal line — your top and lowest scoring sources, based on all-time decisions.
>
> **How the scoring works:** Every keep adds a small positive signal. Every save adds a stronger one. Every skip adds a small negative. Every reject adds a stronger one. New sources start at neutral (50%) and move as you triage. It takes about 5–10 decisions per source before the score is meaningful.
>
> **To drop a source entirely:** Reject everything from it consistently — after a week its score will sink below 30% and its items will always sit at the bottom of the feed. Or remove it from the feeds list in KV.
>
> **One thing worth revisiting now:** Back in Layer 1, you set your morning brief up on the free Cloudflare Workers AI model — exactly the right call to start. But your system has changed. Your brief is no longer summarizing a near-empty vault; it's now synthesizing across a fuller vault *and* the ranked source signals you just built. This is the point where the model doing the writing actually matters — where a stronger model produces noticeably sharper, better-connected output.
>
> If you want that, upgrading your morning brief to Claude is the move, and it's a small change: in your Layer 1 worker's `generateBrief` function, swap the `env.AI.run(...)` call for an Anthropic API call, add an `ANTHROPIC_API_KEY` secret (from console.anthropic.com — a few dollars a month covers daily briefs), and redeploy. The free version keeps working fine if you'd rather not — this is genuinely optional. But now's the moment it's worth considering.
>
> **What's next:** Layer 4 is the agent swarm — a system for dispatching coding tasks and research jobs to AI agents running on your machines. It's optional, and more technical than Layers 0–3. When you're ready, paste `Layer-4-Agent-Swarm.md` into a Claude Code session."

---

## Builder notes

- **Read the existing code before editing.** Layer 3 adds to Layer 2's worker — don't overwrite the whole file. Add the import, add new functions, replace only `handleGetItems` and `generateNightlyBrief`.
- **The `PRIOR = 4` constant** means a source needs roughly 4+ decisions before its score starts moving significantly. This is intentional — it prevents one keep or one reject from swinging the whole source score.
- **Score colors:** green ≥ 65%, yellow 45–65%, red < 45%. These thresholds are in the reader JS as `scoreColor()`. Adjust them if the person finds too many sources marked red early on.
- **The sources tab only shows sources with decisions.** Sources that have been captured but never triaged don't appear — they have no score to show. That's correct.
- **`HAVING total >= 5` in the brief query** means source insights only appear once there's enough signal to be meaningful. In the first few days the source signals line may not appear at all — that's expected.
- **This is Layer 3 of 4.** Layer 4 is optional and structurally separate — it adds an agent dispatch system, not another content layer.
