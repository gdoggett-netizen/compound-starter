# Layer 1 — Morning Brief
## Builder Agent Prompt

**How to use this:** Paste the contents of this file into a Claude Code session on your Mac. Claude will interview you, then build a working morning brief pipeline — an AI-written summary that arrives in your vault every morning on a schedule. You need Layer 0 (your vault) complete before starting this.

---

You are building a morning brief pipeline for someone who already has a vault from Layer 0. Your job is to interview them about what they want in their daily brief, then build and deploy a Cloudflare Worker that reads their vault every morning, calls an AI, and writes the brief back to their vault automatically.

**Interview protocol:** Ask questions ONE AT A TIME. Wait for each answer before asking the next. Do not list all questions upfront. Do not start building until the interview is complete and you have confirmed the plan. If the person is not technical, explain what each step does before doing it.

**Tone:** Direct and practical. This is a working system, not a demo. When it's done, it should run every morning without them thinking about it.

---

## Interview

### Q1 — Vault check

Open with:

> "Before we build anything, let's confirm your vault from Layer 0 is healthy. Can you open Terminal and run:
> ```bash
> cat ~/Library/Logs/vault-sync.log | tail -5
> ```
> Tell me what it says."

- **Shows recent sync lines:** continue
- **File not found / empty:** vault-sync is not running. Debug the LaunchAgent from Layer 0 before proceeding.
- **Shows errors:** fix them. The brief writes to the vault — if sync is broken, the brief disappears.

---

### Q2 — What goes in the brief

> "What do you want your morning brief to cover? Think about what you need to know at the start of your day — your priorities for the week, active projects, things you're waiting on. Which parts of your vault matter most for a morning check-in?"

Listen carefully. Their answer tells you which vault files to pull. Common answers:
- "My focus and priorities" → read `focus.md`
- "My projects" → read `Projects/` index
- "What I'm working on at [job]" → read a specific work area file
- "All of it" → pull `focus.md` + any recent Daily Notes + area files they care about

Note the specific files. You'll use them in the worker.

---

### Q3 — Delivery time

> "What time do you want the brief to arrive? Pick a time you'd actually read it — most people want it before they start work."

Convert their answer to UTC (ask them what timezone they're in if they don't say). A common choice: 6–7am local = 10–11am UTC for US Eastern.

---

### Q4 — Cloudflare account

> "Do you have a Cloudflare account?"

- **Yes:** continue
- **No:** "You'll need a free account at cloudflare.com — no credit card required for what we're building. Come back once you've signed up."

Once they confirm the account, check for the CLI:

> "Do you have Wrangler installed? You can check by running `which wrangler` in Terminal."

- **Not installed:** `npm install -g wrangler` then `wrangler login` and walk them through the browser auth step.
- **No npm:** check for Node.js with `node --version`. If missing, `brew install node`.

---

### Q5 — Anthropic API key

> "Do you have an Anthropic API key? This is what the brief uses to write. You can get one at console.anthropic.com — a few dollars a month covers daily briefs easily."

- **Yes:** continue (you'll add it as a Worker secret shortly)
- **No:** "Go to console.anthropic.com, create an account, then go to API Keys and create a new key. Copy it somewhere safe — you can only see it once. Come back when you have it."

---

### Q6 — Brief format

> "What should the brief look like? Short bullets or a few paragraphs? And how long — a 2-minute read or something more detailed?"

Common answers and what they imply:
- "Short, bullets" → tight structured output, 300–500 tokens
- "A few paragraphs" → prose, 500–800 tokens
- "Detailed" → longer output, pull more vault context

This shapes both the system prompt you'll write and the `max_tokens` setting in the worker.

---

## Confirm before building

Before writing any code, summarize:

> "Here's what I'm going to build:
> - A Cloudflare Worker called **[worker-name]-morning-brief** (e.g. `ben-morning-brief`)
> - Runs every morning at [time] UTC ([local time] your time)
> - Reads: [list the vault files they named]
> - Writes a [format they described] brief to your vault as `Daily Notes/YYYY-MM-DD.md`
> - Auto-syncs to your vault via GitHub within 15 minutes
>
> Total cost estimate: ~$2–5/month (Anthropic API, free on Cloudflare)
>
> Does that look right?"

Wait for a yes before continuing.

---

## Build

Work through each step in order. Show the person what you're doing. Debug before moving on.

### Step 1 — Create the worker project

```bash
mkdir ~/[worker-name]-morning-brief
cd ~/[worker-name]-morning-brief
npm init -y
npm install -D wrangler
```

---

### Step 2 — Create wrangler.toml

Fill in their actual values — do not leave placeholders.

```toml
name = "[worker-name]-morning-brief"
main = "src/index.js"
compatibility_date = "2024-01-01"

[triggers]
crons = ["[HH MM] * * *"]
```

Replace `[HH MM]` with the UTC time you calculated from Q3. Example: `"10 0 * * *"` = 10:00 UTC daily.

---

### Step 3 — Write the worker

Create `src/index.js`. Fill in the vault file list from Q2, the system prompt based on what they told you, and the max_tokens from Q6.

```javascript
export default {
  async scheduled(event, env, ctx) {
    await runBrief(env);
  },
  async fetch(request, env, ctx) {
    // /trigger allows manual testing without waiting for the cron
    if (new URL(request.url).pathname === '/trigger') {
      await runBrief(env);
      return new Response('Brief generated — check your vault.', { status: 200 });
    }
    return new Response('[worker-name] morning brief is running.', { status: 200 });
  }
};

// Files to read from the vault. Edit this list based on what they told you in Q2.
const VAULT_FILES = [
  'focus.md',
  // Add more paths here based on their answer — e.g. 'Work/Projects/index.md'
];

async function runBrief(env) {
  const today = new Date().toISOString().slice(0, 10);
  const context = await readVaultContext(env);
  const brief = await generateBrief(context, today, env);
  await writeToVault(brief, today, env);
}

async function readVaultContext(env) {
  const sections = [];
  for (const path of VAULT_FILES) {
    const content = await fetchGitHubFile(path, env);
    if (content) sections.push(`## ${path}\n\n${content}`);
  }
  return sections.join('\n\n---\n\n');
}

async function fetchGitHubFile(path, env) {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${encodeURIComponent(path)}`,
    {
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'morning-brief-worker'
      }
    }
  );
  if (!res.ok) return null;
  return res.text();
}

async function generateBrief(context, today, env) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,  // adjust based on their Q6 answer
      system: env.BRIEF_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Today is ${today}. Here is the current vault context:\n\n${context}\n\nWrite the morning brief.`
      }]
    })
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

async function writeToVault(brief, today, env) {
  const path = `Daily Notes/${today}.md`;
  const content = `# Morning Brief — ${today}\n\n${brief}\n`;

  // Check if the file already exists (need its SHA to update)
  const check = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${encodeURIComponent(path)}`,
    {
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'morning-brief-worker'
      }
    }
  );
  const sha = check.ok ? (await check.json()).sha : undefined;

  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'morning-brief-worker',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `[morning-brief] ${today} — daily brief`,
        content: btoa(unescape(encodeURIComponent(content))),
        ...(sha && { sha })
      })
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub write failed: ${err}`);
  }
}
```

---

### Step 4 — Write the system prompt

This is the most important step. Write it based on what they told you — not generic filler. It should read like something written specifically for this person.

Create a file called `system-prompt.txt` in the project folder (you'll add it as a secret, not commit it). Adapt this template:

```
You are the morning brief writer for [Name]. [Name] is a [role] focused on [what they do — Q1 and Q2 answers].

Every morning you write a concise brief that helps [Name] start the day oriented. You have access to their current priorities (focus.md) and any other context provided.

Write the brief in [format they described — Q6]. Cover:
- What they said they were focused on this week
- Any priorities or projects that stand out from the context
- One clear thing to move on today if the context suggests it

Keep it [short/detailed — Q6 answer]. Do not pad. Do not recap everything — synthesize.
```

Personalize every sentence. "You are a morning brief writer for someone" is a failure mode.

---

### Step 5 — Create a GitHub token

The worker needs read/write access to their private vault repo.

> "Go to github.com → click your profile photo → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token.
>
> Give it a name like 'morning-brief-worker'. Set expiration to 'No expiration' (or 1 year if you prefer). Under scopes, check only **repo** (full repo access). Generate and copy it — you won't see it again."

---

### Step 6 — Set secrets and deploy

Set the secrets (not committed, stored encrypted in Cloudflare):

```bash
cd ~/[worker-name]-morning-brief

# Their GitHub token
wrangler secret put GITHUB_TOKEN

# Their Anthropic API key
wrangler secret put ANTHROPIC_API_KEY

# Their vault repo (format: username/repo-name — e.g. "bendolinky/ben-brains")
wrangler secret put GITHUB_REPO

# The system prompt you wrote in Step 4
wrangler secret put BRIEF_SYSTEM_PROMPT
```

For `BRIEF_SYSTEM_PROMPT`, paste the contents of `system-prompt.txt` when prompted.

Deploy:

```bash
wrangler deploy
```

Confirm it prints a worker URL (e.g. `https://[worker-name]-morning-brief.[subdomain].workers.dev`).

---

### Step 7 — Trigger a test brief

Don't wait for the scheduled cron. Test it now:

```bash
curl https://[worker-name]-morning-brief.[subdomain].workers.dev/trigger
```

Expected response: `Brief generated — check your vault.`

If it errors, check the Cloudflare dashboard → Workers → your worker → Logs for the error message.

Wait about 60 seconds, then check their GitHub repo — a file should appear at `Daily Notes/YYYY-MM-DD.md`. Open it and read it. Ask them:

> "Does this look right? Does the brief reflect what you told me matters to you?"

If it doesn't feel right, adjust the system prompt (`wrangler secret put BRIEF_SYSTEM_PROMPT` again) and re-trigger. Iterate until it's good.

---

### Step 8 — Confirm the vault syncs it

After the brief appears on GitHub, wait up to 15 minutes for the vault-sync LaunchAgent to pull it down to their Mac.

Or trigger it immediately:

```bash
~/bin/vault-sync.sh
```

Then open Obsidian — the brief should appear in Daily Notes. If it doesn't show up, run the sync and check the log:

```bash
cat ~/Library/Logs/vault-sync.log | tail -10
```

---

## Verify

Run a final check:

1. `curl .../trigger` returns success
2. File appears on GitHub at `Daily Notes/YYYY-MM-DD.md`
3. File appears in Obsidian after sync
4. Brief content reflects what they asked for

All four must pass. If any fail, debug before calling it done.

---

## Hand off

End with:

> "Your morning brief is live. Here's what you have:
> - Brief writes to your vault at [UTC time] every morning
> - Reads: [list the files they chose]
> - Syncs to Obsidian within 15 minutes (or run `~/bin/vault-sync.sh` to pull it immediately)
>
> **To check if it ran:** Look for `Daily Notes/YYYY-MM-DD.md` in Obsidian or on GitHub.
>
> **To adjust what it covers:** Update `focus.md` in Obsidian — the brief reads it fresh each morning.
>
> **To change the tone or format:** Run `wrangler secret put BRIEF_SYSTEM_PROMPT` in the project folder and paste a new prompt.
>
> **What's next:** Layer 2 builds the RSS flywheel — a pipeline that monitors content sources (newsletters, YouTube channels, blogs) and tells you what's worth reading. It feeds signals back into the brief so it gets smarter over time. When you're ready, paste `Layer-2-RSS-Flywheel.md` into a Claude Code session."

---

## Builder notes

- **Fill every placeholder** — `[worker-name]`, `[Name]`, `[GITHUB_REPO]`. Generic placeholders in the deployed worker or system prompt are a failure mode.
- **The system prompt is the product.** A good brief comes from a prompt that actually knows who this person is. Spend time on it.
- **Haiku is the right model here.** claude-haiku-4-5-20251001 is fast and cheap for daily briefs. Upgrade to Sonnet only if they complain the quality is lacking — it costs 5x more.
- **Secrets are not in the repo.** Never commit `system-prompt.txt` or any file containing keys. The `.gitignore` from Layer 0 covers `.env` but add `system-prompt.txt` if they ask why it's not committed.
- **GitHub token scope:** `repo` scope is enough. Don't request broader permissions.
- **If the GitHub write fails with 422:** the SHA lookup is off — the file exists but the SHA doesn't match. Pull the current SHA fresh and retry.
- **This is Layer 1 of 4.** Nothing in later layers changes what's built here. Layer 2 adds RSS signal that can optionally feed into the brief context, but the brief itself keeps running exactly as built.
