# Layer 2 — RSS Flywheel
## Builder Agent Prompt

**How to use this:** Paste the contents of this file into a Claude Code session on your Mac. Claude will interview you, then build a working content pipeline — a system that monitors sources you care about, lets you triage what's worth reading, and writes a nightly synthesis brief back to your vault. You need Layers 0 and 1 complete before starting this.

---

You are building a content intelligence layer for someone who already has a vault (Layer 0) and a morning brief (Layer 1). The goal is to give them a daily triage queue — a stream of content from sources they trust — and turn their keep/reject decisions into a nightly brief and, over time, a smarter feed.

**Interview protocol:** Ask questions ONE AT A TIME. Wait for each answer before asking the next. Do not list all questions upfront. Do not start building until the interview is complete and confirmed. If the person is not technical, explain what each step does before doing it. Before you begin, check their `CLAUDE.md` for how they like to be guided (casual and analogy-rich, or direct and to-the-point) and match that tone throughout. Never condescend — assume real intelligence. Explain the *value* of each step in the context of their actual life or work, never in a vacuum. Actively invite them to ask questions and pitch their own ideas as you go — treat them as a partner, not a student.

**Tone:** Practical and curious. This layer is about information diet — you're helping them take control of what they read. The best systems here are ones the person actually opens every day.

---

## Before you start — your terminal (optional, 30 seconds)

**If you already use Warp, skip this — you're all set.** This is only for anyone still on the plain Mac Terminal who'd like a nicer setup. Open with:

> "Quick check before we build: are you working in **Warp**, or the plain Mac **Terminal**? If you've already got Warp, just say so and we'll jump right in. If not — and you'd like a cleaner, friendlier terminal — now's a good time to grab it: go to **warp.dev**, download it, drag it into your Applications folder, and open it. One heads-up: Warp has its *own* built-in AI assistant — **ignore that** (it's not what we're using, and it can cost money). Your AI is Claude Code, same as always — just open Warp and run `claude`. Totally optional, though; the plain Terminal works perfectly fine if you'd rather skip it."

Don't let this become a project — it's a 30-second optional upgrade. Once they tell you which terminal they're in, move straight on to the interview.

---

## Interview

### Q1 — System check

Open with:

> "Before we build anything, let's confirm your Layer 1 morning brief is running. Is it arriving in your vault every morning?"

- **Yes, it's working:** continue
- **No / not sure:** go fix Layer 1 first. The brief from Layer 2 can optionally feed into Layer 1 — but if Layer 1 isn't running, there's nothing to feed into.

---

### Q2 — Content sources

> "What sources do you want to follow? Think about newsletters, blogs, industry sites, YouTube channels — anything you currently check manually that you'd rather have delivered to you. List as many as you'd like, and include the URL for each."

**Explain RSS with an analogy:** "RSS is like a magazine subscription, but for websites. Instead of you visiting ten different sites to check for new stuff, each one mails its new articles to a single mailbox automatically. We're setting up that mailbox."

For each source they name, you need the RSS feed URL. Common patterns:
- Most blogs/news sites: `https://[site]/feed` or `https://[site]/rss` or `https://[site]/feed.xml`
- Substack newsletters: `https://[newsletter].substack.com/feed`
- YouTube channels: `https://www.youtube.com/feeds/videos.xml?channel_id=[CHANNEL_ID]` — find the channel ID in the page source or by inspecting the URL
- If they name a site and aren't sure if it has RSS, try `[site]/feed` and `[site]/rss` — most do

For any source where you can't find a valid RSS URL, tell them clearly: "I couldn't find an RSS feed for [source] — want to skip it for now or look for an alternative?"

Note all valid feed URLs. You'll store them in the system after deployment.

---

### Q3 — Reading habits

> "How often do you want to check this? Some people open it every morning and triage everything since yesterday. Others check it a few times a day. And what time should the nightly brief arrive — that's the AI synthesis of everything you kept that day."

This shapes two settings:
- **Poll frequency:** how often the worker fetches new content. Every 30 minutes is a good default — fast enough to feel fresh, not so fast it wastes resources.
- **Brief time:** convert to UTC. 9pm or 10pm local is a common choice — the day's reading is done by then.

---

### Q4 — Brief format

> "The nightly brief takes everything you marked 'Keep' that day and has AI synthesize the key themes. How do you want it — a few tight bullets hitting the main ideas, or a short paragraph per theme?"

This shapes the synthesis prompt you'll write in Step 5.

---

## Confirm before building

Before writing any code, summarize:

> "Here's what I'm going to build:
>
> - **RSS poller** — checks [N] sources every 30 minutes, captures new items
> - **Triage reader** — a web page where you keep/reject/save/skip each item
> - **Nightly brief** — AI synthesis of what you kept, written to your vault at [time] each evening
>
> Sources:
> [list each feed name and URL]
>
> This runs **free** — same Cloudflare Workers AI as your morning brief, no API key and no cost.
>
> Does that look right before I build?"

Wait for a yes.

---

## Build

Work through each step in order. Show the person what you're doing as you go. Debug before moving on.

---

### Step 1 — Create the project

```bash
mkdir ~/[worker-name]-rss
cd ~/[worker-name]-rss
npm init -y
npm install -D wrangler
npm install fast-xml-parser
```

`fast-xml-parser` handles both RSS 2.0 and Atom feeds without relying on a Node.js XML parser — it works in Cloudflare Workers.

---

### Step 2 — Create the D1 database

**Explain it with an analogy:** "A database (D1) is just a smart spreadsheet that lives in the cloud. It's where we'll keep every article we pull in — one row per item — so we can sort, filter, and remember them. Same idea as a spreadsheet, but built to handle thousands of rows without breaking a sweat."

```bash
wrangler d1 create [worker-name]-rss
```

Copy the `database_id` from the output — you'll need it for `wrangler.toml`.

Apply the schema:

```bash
wrangler d1 execute [worker-name]-rss --remote --command "
CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  kept_at TEXT,
  rejected_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_url ON captures(url);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_id TEXT NOT NULL,
  action TEXT NOT NULL,
  ts TEXT NOT NULL
);
"
```

---

### Step 3 — Create the KV namespace

**Explain it with an analogy:** "KV is like a row of labeled sticky notes — a quick place to jot down small facts the system needs to remember, like 'when did I last check the feeds?' The spreadsheet (D1) is for lots of rows; sticky notes (KV) are for quick one-off facts. Right tool for each job."

```bash
wrangler kv namespace create RSS_KV
```

Copy the `id` from the output — you'll need it for `wrangler.toml`.

---

### Step 4 — Create wrangler.toml

Fill in the `database_id` and KV `id` from the steps above. Fill in the cron times — one for polling (every 30 min), one for the nightly brief (UTC time from Q3).

```toml
name = "[worker-name]-rss"
main = "src/index.js"
compatibility_date = "2024-01-01"

[triggers]
crons = ["*/30 * * * *", "[HH MM] * * *"]

[[d1_databases]]
binding = "DB"
database_name = "[worker-name]-rss"
database_id = "FILL_IN_FROM_STEP_2"

[[kv_namespaces]]
binding = "RSS_KV"
id = "FILL_IN_FROM_STEP_3"

[ai]
binding = "AI"
```

The `[ai]` binding connects the worker to **Cloudflare Workers AI** — the same free AI your morning brief uses. No API key, no cost.

Replace `[HH MM]` with the UTC time for the nightly brief. Example: `"0 2 * * *"` = 2:00 UTC = 10pm ET.

---

### Step 5 — Write the nightly brief system prompt

Create `system-prompt.txt` (not committed — added as a secret). Personalize it from the interview. Base template:

```
You write nightly content briefs for [Name]. [Name] follows these topics: [list what they said in Q2 — their areas of interest].

Given a list of articles and content they kept today, synthesize the key themes and ideas in [format from Q4 — bullets or short paragraphs]. Be specific: reference actual titles and ideas. Don't pad. If only one or two items were kept, synthesize those specifically rather than inventing themes.
```

Fill in `[Name]` and their actual interests. A generic prompt produces a generic brief.

---

### Step 6 — Write the worker

Create `src/index.js`. Read the code carefully — there are two placeholders to fill in before deploying: the READER title (their name) and the list of sources (from Q2).

**Explain the four buttons — don't assume the difference is obvious.** Tell them:

> "Each item gives you four choices: **Keep** (good — I read it), **Save** (loved it — save for later), **Skip** (meh, not for me), **Reject** (never show me this source again). Keep and Save tell the system *more like this*; Skip and Reject tell it *less*. In the next layer, those choices are what make your feed smarter over time."

**Then make it clear this is THEIR reader, not a fixed template — offer to build their vision.** Say something like:

> "This is just my starting design. It's *your* reader, so if you want it to look or work differently, just describe it and I'll rebuild it for you. For example: 'don't like where the buttons are — move them to the left,' or 'make it cleaner, more like Twitter,' or 'bigger text and put Save first.' What's your vision?"

If they describe changes, adapt the HTML/CSS to match *before* you deploy. If they're happy with the default, continue as-is. Everything else in the code deploys unchanged.

```javascript
import { XMLParser } from 'fast-xml-parser';

// ── Reader UI ────────────────────────────────────────────────────────────────

const READER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>[Name]'s Reader</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  .header { padding: 16px 20px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 12px; }
  .header h1 { font-size: 16px; font-weight: 600; color: #f1f5f9; }
  .count { font-size: 13px; color: #64748b; }
  .feed { max-width: 680px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .card { background: #1e293b; border-radius: 8px; padding: 14px 16px; }
  .card-source { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .card-title { font-size: 15px; font-weight: 500; color: #f1f5f9; line-height: 1.4; margin-bottom: 10px; }
  .card-title a { color: inherit; text-decoration: none; }
  .card-title a:hover { color: #38bdf8; }
  .card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn { padding: 5px 14px; border-radius: 5px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: opacity 0.15s; }
  .btn:hover { opacity: 0.8; }
  .btn-keep { background: #166534; color: #86efac; }
  .btn-save { background: #1e3a8a; color: #93c5fd; }
  .btn-skip { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
  .btn-reject { background: #7f1d1d; color: #fca5a5; }
  .legend { max-width: 680px; margin: 0 auto; padding: 10px 16px 0; font-size: 12px; color: #64748b; line-height: 1.5; }
  .empty { text-align: center; color: #475569; padding: 60px 20px; font-size: 15px; }
  .loading { text-align: center; color: #475569; padding: 40px; }
</style>
</head>
<body>
<div class="header">
  <h1>[Name]'s Reader</h1>
  <span class="count" id="count">loading...</span>
</div>
<div class="legend"><strong>Keep</strong> = good · <strong>Save</strong> = loved it (read later) · <strong>Skip</strong> = meh · <strong>Reject</strong> = never show me this source</div>
<div class="feed" id="feed"><div class="loading">Loading...</div></div>
<script>
let items = [];
async function load() {
  const res = await fetch('/api/items?limit=100');
  const data = await res.json();
  items = data.items || [];
  render();
}
function render() {
  const feed = document.getElementById('feed');
  document.getElementById('count').textContent = items.length + ' items';
  if (!items.length) {
    feed.innerHTML = '<div class="empty">All caught up.</div>';
    return;
  }
  feed.innerHTML = items.map(i => \`
    <div class="card" id="c-\${i.id}">
      <div class="card-source">\${i.source}</div>
      <div class="card-title"><a href="\${i.url}" target="_blank" rel="noopener">\${i.title}</a></div>
      <div class="card-actions">
        <button class="btn btn-keep" onclick="decide('\${i.id}','keep')">Keep</button>
        <button class="btn btn-save" onclick="decide('\${i.id}','save')">Save</button>
        <button class="btn btn-skip" onclick="decide('\${i.id}','skip')">Skip</button>
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
  render();
}
load();
</script>
</body>
</html>`;

// ── Worker entry ──────────────────────────────────────────────────────────────

export default {
  async scheduled(event, env) {
    // Two cron jobs share this handler — tell them apart by the cron expression
    if (event.cron.startsWith('*/30')) {
      await pollFeeds(env);
    } else {
      await generateNightlyBrief(env);
    }
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/') return new Response(READER_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (pathname === '/api/items') return handleGetItems(url, env);

    const decisionMatch = pathname.match(/^\/api\/items\/([^/]+)\/(keep|reject|save|skip)$/);
    if (decisionMatch) return handleDecision(decisionMatch[1], decisionMatch[2], env);

    // Manual trigger endpoints for testing
    if (pathname === '/trigger/poll')  { await pollFeeds(env);             return new Response('Polled.'); }
    if (pathname === '/trigger/brief') { await generateNightlyBrief(env);  return new Response('Brief generated — check your vault.'); }

    return new Response('Not found', { status: 404 });
  }
};

// ── Feed polling ──────────────────────────────────────────────────────────────

async function pollFeeds(env) {
  const feedsRaw = await env.RSS_KV.get('feeds');
  if (!feedsRaw) { console.log('No feeds configured in KV.'); return; }
  const feeds = JSON.parse(feedsRaw);

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'rss-flywheel/1.0' } });
      if (!res.ok) { console.error(`Feed ${feed.name}: HTTP ${res.status}`); continue; }
      const xml = await res.text();
      const items = parseItems(parser.parse(xml), feed.name);
      for (const item of items) {
        await env.DB.prepare(
          'INSERT OR IGNORE INTO captures (id, title, url, source, captured_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(item.id, item.title, item.url, item.source, item.capturedAt).run();
      }
    } catch (e) {
      console.error(`Feed ${feed.name} error:`, e.message);
    }
  }
}

function parseItems(parsed, sourceName) {
  // Handle RSS 2.0
  let raw = parsed?.rss?.channel?.item ?? [];
  // Handle Atom
  if (!raw.length) raw = parsed?.feed?.entry ?? [];

  if (!Array.isArray(raw)) raw = [raw];

  return raw.slice(0, 20).flatMap(item => {
    const title = item.title?.['#text'] ?? item.title ?? '';
    const link = item.link?.['@_href'] ?? item.link ?? '';
    if (!title || !link) return [];
    return [{ id: crypto.randomUUID(), title: String(title).trim(), url: String(link).trim(), source: sourceName, capturedAt: new Date().toISOString() }];
  });
}

// ── Reader API ────────────────────────────────────────────────────────────────

async function handleGetItems(url, env) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const result = await env.DB.prepare(
    'SELECT id, title, url, source, captured_at FROM captures WHERE kept_at IS NULL AND rejected_at IS NULL ORDER BY captured_at DESC LIMIT ?'
  ).bind(limit).all();
  return Response.json({ items: result.results ?? [] });
}

async function handleDecision(id, action, env) {
  const now = new Date().toISOString();
  if (action === 'keep' || action === 'save') {
    await env.DB.prepare('UPDATE captures SET kept_at = ? WHERE id = ?').bind(now, id).run();
  } else {
    await env.DB.prepare('UPDATE captures SET rejected_at = ? WHERE id = ?').bind(now, id).run();
  }
  await env.DB.prepare('INSERT INTO decisions (capture_id, action, ts) VALUES (?, ?, ?)').bind(id, action, now).run();
  return Response.json({ ok: true });
}

// ── Nightly brief ─────────────────────────────────────────────────────────────

async function generateNightlyBrief(env) {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const result = await env.DB.prepare(
    'SELECT c.title, c.url, c.source FROM captures c WHERE c.kept_at > ? ORDER BY c.kept_at DESC'
  ).bind(since).all();

  const kept = result.results ?? [];
  if (!kept.length) { console.log('Nothing kept today — skipping brief.'); return; }

  const itemList = kept.map(i => `- [${i.source}] ${i.title}\n  ${i.url}`).join('\n');

  const aiResp = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: env.BRIEF_SYSTEM_PROMPT },
      { role: 'user', content: `Today is ${today}. Here is the content I kept:\n\n${itemList}\n\nWrite the nightly brief.` }
    ]
  });
  const brief = aiResp.response;

  const content = `# Content Brief — ${today}\n\n${brief}\n\n---\n\n## Kept today\n\n${itemList}\n`;
  if (env.GITHUB_TOKEN && env.GITHUB_REPO) {
    await writeToVault(content, `Agent Outputs/[RSS] ${today}.md`, env);
  }
}

async function writeToVault(content, path, env) {
  const headers = { Authorization: `token ${env.GITHUB_TOKEN}`, 'User-Agent': 'rss-flywheel', 'Content-Type': 'application/json' };
  const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${encodeURIComponent(path)}`;
  const check = await fetch(apiUrl, { headers });
  const sha = check.ok ? (await check.json()).sha : undefined;
  const res = await fetch(apiUrl, {
    method: 'PUT', headers,
    body: JSON.stringify({ message: `[rss-flywheel] ${new Date().toISOString().slice(0,10)} — nightly brief`, content: btoa(unescape(encodeURIComponent(content))), ...(sha && { sha }) })
  });
  if (!res.ok) console.error('GitHub write failed:', await res.text());
}
```

Before saving this file, fill in the two `[Name]` placeholders in `READER_HTML` with their actual name from the interview.

---

### Step 7 — Set secrets

No AI key needed — the brief runs on free Cloudflare Workers AI via the `AI` binding in `wrangler.toml`. You only set three secrets:

```bash
cd ~/[worker-name]-rss

wrangler secret put BRIEF_SYSTEM_PROMPT
# paste the contents of system-prompt.txt

wrangler secret put GITHUB_TOKEN
# paste their GitHub token from Layer 1 (or create a new one with repo scope)

wrangler secret put GITHUB_REPO
# type: username/repo-name (e.g. bendolinky/ben-brains)
```

If they don't want the nightly brief in their vault yet, skip `GITHUB_TOKEN` and `GITHUB_REPO` — the worker will still run, it just won't write to the vault.

---

### Step 8 — Deploy

```bash
wrangler deploy
```

Copy the worker URL it prints (e.g. `https://[worker-name]-rss.[subdomain].workers.dev`).

---

### Step 9 — Add their feeds to KV

Store the feed list as JSON in KV. Build the JSON from the URLs you gathered in Q2 — one object per feed, with `name` and `url`.

```bash
wrangler kv key put --binding=RSS_KV feeds '[
  {"name": "Source Name 1", "url": "https://example.com/feed"},
  {"name": "Source Name 2", "url": "https://newsletter.substack.com/feed"}
]'
```

Replace the name/URL pairs with their actual feeds. Names appear as the source label in the reader.

---

### Step 10 — Test the poll

Trigger the RSS poll manually:

```bash
curl https://[worker-name]-rss.[subdomain].workers.dev/trigger/poll
```

Then open the reader in a browser:

```
https://[worker-name]-rss.[subdomain].workers.dev/
```

New items from their feeds should appear. If nothing shows up:
1. Check Cloudflare dashboard → Workers → your worker → Logs for errors
2. Confirm the KV feeds key was set: `wrangler kv key get --binding=RSS_KV feeds`
3. Test one feed URL directly: `curl -L [feed URL]` — confirm it returns XML

Try keeping a few items and confirm they disappear from the queue (they're now in the kept pile for tonight's brief).

---

### Step 11 — Test the nightly brief

Trigger it manually — don't wait for the cron:

```bash
curl https://[worker-name]-rss.[subdomain].workers.dev/trigger/brief
```

Expected: `Brief generated — check your vault.`

If they kept items in Step 10, the brief should appear in their vault within 15 minutes (or immediately after running `~/bin/vault-sync.sh`). Open Obsidian and look in `Agent Outputs/`.

If the brief doesn't appear:
1. Check Worker logs for errors
2. If GitHub secrets weren't set, the brief ran but wasn't written to vault — set the secrets and trigger again

---

## Verify

All four must pass before calling this done:

1. **Reader loads** — open the URL, items are visible with source labels
2. **Triage works** — keep or reject an item, confirm it disappears from the queue
3. **Poll works** — trigger `/trigger/poll`, wait 10 seconds, refresh — new items appear if the feeds have updates
4. **Brief writes to vault** — trigger `/trigger/brief`, find `Agent Outputs/[RSS] YYYY-MM-DD.md` in Obsidian or GitHub

---

## Hand off

End with:

> "Your RSS flywheel is live. Here's what you have:
>
> - **Reader:** `https://[worker-name]-rss.[subdomain].workers.dev/` — open this any time to triage new content
> - **Poll:** every 30 minutes, new items from your [N] sources appear in the reader automatically
> - **Brief:** every evening at [time], a synthesis of what you kept that day writes to your vault
>
> **To add a new source later:** find its RSS URL, then run:
> ```bash
> cd ~/[worker-name]-rss
> wrangler kv key get --binding=RSS_KV feeds  # get current list
> wrangler kv key put --binding=RSS_KV feeds '[...updated list...]'
> ```
>
> **To add the reader to your phone:** open the URL in Safari, tap Share → Add to Home Screen. It works as a mobile triage queue with no app install needed.
>
> **What's next:** Layer 3 builds the Content Intelligence Layer — it makes your feed smarter over time by tracking your decisions and using them to score and rank content by source. The more you triage, the better the feed gets. When you're ready, paste `Layer-3-Content-Intelligence.md` into a Claude Code session."

---

## Builder notes

- **Fill both `[Name]` placeholders** in `READER_HTML` before deploying — one in the `<title>`, one in the `<h1>`.
- **The feeds list is in KV, not code** — no redeployment needed to add or remove sources. This is intentional.
- **`INSERT OR IGNORE`** on the URL unique index means the same article can never appear twice, even if it stays in the feed for days.
- **The brief runs free on Cloudflare Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) — same as the Layer 1 morning brief. No API key, no cost. Synthesis of 10–20 kept items is well within what the free model handles. If they ever want sharper output, the optional Claude upgrade is the same swap surfaced in Layer 3.
- **YouTube RSS feeds:** the URL format is `https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxx`. The channel ID is in the page source under `<link rel="alternate" ...>` or in the channel URL for YouTube handles.
- **Substack RSS:** every Substack newsletter has `/feed` — e.g. `https://stratechery.com/feed`.
- **If a feed returns non-XML** (paywalled content, redirects, HTML): `parseItems` will return an empty array — it won't crash, but nothing gets captured. Check the Worker logs if a source seems silent.
- **This is Layer 2 of 4.** Layer 3 adds source scoring from decisions — the decisions table built here is the input. Nothing changes in Layer 2 when Layer 3 is added.
