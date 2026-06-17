# Layer 4 — Agent Swarm
## Builder Agent Prompt

**How to use this:** Paste the contents of this file into a Claude Code session on your Mac. Claude will interview you, then build a task queue system — a way to drop work into your vault from anywhere (including your phone) and have an AI agent on your Mac pick it up and complete it automatically. This is the most technical layer. Layers 0–3 must be complete before starting.

---

You are building an autonomous task runner. The person already has a vault, a morning brief, an RSS reader, and source scoring. What they don't have yet: a way to dispatch work to an AI agent and have it complete that work without them sitting at their computer. Layer 4 gives them that.

The simplest version runs on a single Mac:
- A task inbox folder in the vault
- A runner script that polls the inbox, runs each task with Claude Code, and writes results back to the vault
- A LaunchAgent that checks for new tasks every 10 minutes
- An optional phone dispatch interface so they can send tasks from anywhere

This is a foundation. One Mac can run the tasks. Later, if they want heavier or parallel workloads, they can route tasks to additional machines over SSH — but that's not required to start.

**Interview protocol:** Ask questions ONE AT A TIME. Wait for each answer before asking the next. Do not start building until confirmed. Be honest about complexity — this layer requires shell scripting, LaunchAgents, and Claude Code in headless mode. If they get stuck, debug before moving on.

**Tone:** Measured and precise. This is the layer where things can break silently. Set expectations that debugging is normal, and show them how to check the logs at every step.

---

## Interview

### Q1 — System check

Open with:

> "Before we build anything, let's confirm your vault is syncing and your morning brief is arriving. Can you check two things:
> 1. `cat ~/Library/Logs/vault-sync.log | tail -3` — should show a recent sync
> 2. Open Obsidian — does today's morning brief appear in Daily Notes?"

Both must be working. The task runner writes results to the vault and depends on git being in a good state.

---

### Q2 — What tasks to automate

> "What kind of work do you want an AI to do for you while you're away from your computer? A few examples:
> - Research: 'Find the top 5 government procurement RSS feeds and add them to my vault'
> - Writing: 'Summarize this meeting note and write a follow-up email draft'
> - Analysis: 'Read these three notes and tell me what's missing from my proposal'
> - Coding: 'Add a new route to my API that does X'
>
> What's most useful to you?"

Their answer shapes:
- What task templates you'll write for them
- Whether the runner needs to work in repo directories (coding tasks) or just the vault (research/writing)
- How detailed the task format needs to be

Note: tasks that need real-time data (current stock prices, live news) or external APIs (sending emails, submitting forms) are out of scope for this layer. The runner reads from the vault and writes back to it — it doesn't browse the internet or touch external services unless Claude Code's tools can reach them.

---

### Q3 — Phone dispatch

> "Do you want to be able to send tasks from your phone? For example, you think of something while commuting and want to queue it up without waiting to be at your Mac. I can build a simple web form you can add to your phone's home screen."

- **Yes:** you'll build a lightweight Cloudflare Worker that accepts the task and writes it to the vault's inbox via GitHub API. The Mac picks it up on the next vault sync.
- **No:** skip the phone dispatch section.

---

## Confirm before building

Summarize:

> "Here's what I'm going to build:
>
> - **Task inbox:** `[VaultName]/Tasks/inbox/` — drop a `.md` file here, the runner picks it up
> - **Task runner:** `~/bin/task-runner.sh` — runs every 10 minutes, processes each task with Claude Code, writes results to your vault
> - **Task queue:** `Tasks/done/` (completed) and `Tasks/errors/` (failed) for visibility
> [If yes to Q3:] - **Phone dispatch:** a Cloudflare Worker with a web form — add it to your home screen, type a task, it lands in your inbox within 15 minutes
>
> Tasks you'll start with: [list 1–2 from their Q2 answer]
>
> Does that look right?"

Wait for a yes.

---

## Build

---

### Step 1 — Create the task queue structure

```bash
cd ~/[VaultName]
mkdir -p "Tasks/inbox" "Tasks/done" "Tasks/errors" "Tasks/templates"
```

Create a README for the inbox so it's clear what goes there:

```bash
cat > "Tasks/README.md" << 'EOF'
# Task Queue

Drop task files in `inbox/` — the runner picks them up every 10 minutes.

## Task file format

```
# Task: [title]
Created: YYYY-MM-DD HH:MM
Output: path/relative/to/vault.md

## Task

[What you want done. Be specific.]

## Context

[Optional: background, relevant files to check, URLs]
```

## Folders

- `inbox/` — pending tasks (drop files here)
- `done/` — completed tasks (runner moves them here)
- `errors/` — tasks that failed (check runner log for why)
- `templates/` — reusable task templates

## Log

```bash
cat ~/Library/Logs/task-runner.log | tail -20
```
EOF
```

Write this structure to the vault and sync it:

```bash
cd ~/[VaultName]
git add .
git commit -m "[vault] task queue structure"
git push
```

---

### Step 2 — Verify Claude Code headless mode

The runner invokes Claude Code non-interactively. Confirm it works before writing the runner:

```bash
claude -p "What is 2 + 2? Reply with just the number."
```

Expected: `4` (or similar brief response). If this fails, Claude Code isn't in PATH — find it:

```bash
which claude
# If not found:
ls ~/.claude/bin/
ls /usr/local/bin/claude
```

Note the full path. You'll use it explicitly in the runner script.

---

### Step 3 — Write the task runner

Write `~/bin/task-runner.sh`. Fill in the actual vault path and claude binary path.

```bash
#!/bin/bash
# task-runner.sh — polls vault inbox and runs tasks with Claude Code

VAULT="$HOME/[VaultName]"
INBOX="$VAULT/Tasks/inbox"
DONE="$VAULT/Tasks/done"
ERRORS="$VAULT/Tasks/errors"
LOG="$HOME/Library/Logs/task-runner.log"
CLAUDE="$(which claude)"  # or full path if not in PATH

mkdir -p "$DONE" "$ERRORS"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

# Pull latest vault state before checking inbox
cd "$VAULT" && git pull --quiet 2>>"$LOG"

shopt -s nullglob
tasks=("$INBOX"/*.md)
[ ${#tasks[@]} -eq 0 ] && exit 0

for task_file in "${tasks[@]}"; do
  [ -f "$task_file" ] || continue
  task_name=$(basename "$task_file" .md)
  log "Starting: $task_name"

  # Parse metadata lines
  repo_raw=$(grep -m1 '^Repo:' "$task_file"   | sed 's/^Repo: *//')
  out_raw=$(grep  -m1 '^Output:' "$task_file" | sed 's/^Output: *//')

  # Resolve working directory — default to vault
  work_dir="${repo_raw:-$VAULT}"
  work_dir="${work_dir/#\~/$HOME}"

  if [ ! -d "$work_dir" ]; then
    log "ERROR: directory not found: $work_dir"
    mv "$task_file" "$ERRORS/${task_name}-$(date +%Y%m%d%H%M).md"
    continue
  fi

  # Run with Claude Code — capture stdout, errors go to log
  result=$(cd "$work_dir" && "$CLAUDE" -p "$(cat "$task_file")" 2>>"$LOG")
  exit_code=$?

  if [ $exit_code -ne 0 ]; then
    log "ERROR: claude exited $exit_code for $task_name"
    mv "$task_file" "$ERRORS/${task_name}-$(date +%Y%m%d%H%M).md"
    continue
  fi

  # Write result
  if [ -n "$out_raw" ]; then
    out_path="$VAULT/$out_raw"
    mkdir -p "$(dirname "$out_path")"
    printf '%s\n' "$result" > "$out_path"
    log "Result → $out_raw"
  else
    fallback="$VAULT/Agent Outputs/Task - ${task_name} - $(date +%Y-%m-%d).md"
    printf '%s\n' "$result" > "$fallback"
    log "Result → Agent Outputs/ (no Output: line in task)"
  fi

  # Move task to done
  mv "$task_file" "$DONE/${task_name}-$(date +%Y%m%d%H%M).md"
  log "Done: $task_name"

  # Commit result
  cd "$VAULT"
  git add .
  git diff --cached --quiet || git commit -m "[task-runner] $(date +%Y-%m-%d) — $task_name"
  git push --quiet 2>>"$LOG"
done
```

Make it executable:

```bash
chmod +x ~/bin/task-runner.sh
```

---

### Step 4 — Set up the LaunchAgent `[Mac only]`

Write `~/Library/LaunchAgents/com.[repo-slug].task-runner.plist`. Fill in the actual username and vault name.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.[repo-slug].task-runner</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/[username]/bin/task-runner.sh</string>
  </array>
  <key>StartInterval</key>
  <integer>600</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>/Users/[username]/Library/Logs/task-runner.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/[username]/Library/Logs/task-runner.log</string>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.[repo-slug].task-runner.plist
launchctl list | grep task-runner
```

Should print a line with the label. Note: `RunAtLoad` is `false` — it won't run immediately on load, only on the 10-minute interval. That's intentional.

---

### Step 5 — Write the task templates

Create 1–2 task templates based on what they said in Q2. These go in `Tasks/templates/` so they can copy and fill them in quickly.

Example for research tasks:

```markdown
# Task: Research - [Topic]
Created: [date]
Output: Resources/Research - [Topic] - [date].md

## Task

Research [topic] and write a structured summary. Focus on:
- [specific angle 1]
- [specific angle 2]

Format: bullet points with a 2-3 sentence intro. Max 500 words.

## Context

[Any relevant vault files to check, or background the agent should know]
```

Example for writing tasks:

```markdown
# Task: Draft - [Document Name]
Created: [date]
Output: Projects/[Project]/[Document] - [date].md

## Task

Write a [type of document] based on the context below. Tone: [professional/casual/etc].

## Context

[Paste relevant notes, bullet points, or file paths to read]
```

Write these to `Tasks/templates/` and commit them.

---

### Step 6 — Run a test task

Write a simple test task to confirm the whole chain works:

```bash
cat > ~/[VaultName]/Tasks/inbox/test-swarm-$(date +%Y%m%d).md << 'EOF'
# Task: Swarm test
Created: TODAY
Output: Resources/Swarm-Test-Result.md

## Task

Write a single sentence confirming that the task runner is working. Include today's date.
EOF
```

Run the runner manually (don't wait 10 minutes):

```bash
~/bin/task-runner.sh
```

Watch the output. You should see:
```
[timestamp] Starting: test-swarm-YYYYMMDD
[timestamp] Result → Resources/Swarm-Test-Result.md
[timestamp] Done: test-swarm-YYYYMMDD
```

Then check the result:

```bash
cat ~/[VaultName]/Resources/Swarm-Test-Result.md
```

It should contain a sentence from Claude Code. Also confirm in Obsidian that the file appears.

If the runner fails, check the log:

```bash
cat ~/Library/Logs/task-runner.log | tail -20
```

Common failure reasons: `claude` not found (wrong PATH), vault git state dirty (uncommitted conflict), task file malformed.

---

### Step 7 — Phone dispatch (if applicable)

If they said yes in Q3, build a small Cloudflare Worker that accepts task input and writes it to the vault's inbox via GitHub API.

```bash
mkdir ~/[worker-name]-task-dispatch
cd ~/[worker-name]-task-dispatch
npm init -y
npm install -D wrangler
```

Create `wrangler.toml`:

```toml
name = "[worker-name]-task-dispatch"
main = "src/index.js"
compatibility_date = "2024-01-01"
```

Create `src/index.js`:

```javascript
const FORM_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Send Task</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 24px 16px; }
  h1 { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #f1f5f9; }
  label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  input, textarea, select { width: 100%; padding: 10px 12px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #f1f5f9; font-size: 15px; margin-bottom: 14px; }
  textarea { height: 140px; resize: vertical; font-family: inherit; }
  button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.5; }
  .msg { margin-top: 14px; padding: 10px 14px; border-radius: 6px; font-size: 14px; display: none; }
  .msg.ok  { background: #14532d; color: #86efac; }
  .msg.err { background: #7f1d1d; color: #fca5a5; }
</style>
</head>
<body>
<h1>Send a task</h1>
<form id="f">
  <label>Title</label>
  <input id="title" placeholder="Research government RSS feeds" required>
  <label>Task description</label>
  <textarea id="desc" placeholder="What should the agent do? Be specific about expected output." required></textarea>
  <label>Output path (optional)</label>
  <input id="output" placeholder="Resources/Research - Topic - 2026-06-13.md">
  <button type="submit" id="btn">Send task</button>
</form>
<div class="msg" id="msg"></div>
<script>
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn');
  const msg = document.getElementById('msg');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  try {
    const res = await fetch('/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: document.getElementById('title').value,
        desc:  document.getElementById('desc').value,
        output: document.getElementById('output').value
      })
    });
    const data = await res.json();
    msg.className = 'msg ' + (data.ok ? 'ok' : 'err');
    msg.textContent = data.ok ? 'Task queued — your Mac will pick it up within 15 minutes.' : ('Error: ' + data.error);
    msg.style.display = 'block';
    if (data.ok) document.getElementById('f').reset();
  } catch (err) {
    msg.className = 'msg err';
    msg.textContent = 'Network error — try again.';
    msg.style.display = 'block';
  }
  btn.disabled = false;
  btn.textContent = 'Send task';
};
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(FORM_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (request.method === 'POST' && url.pathname === '/send') {
      try {
        const { title, desc, output } = await request.json();
        if (!title || !desc) return Response.json({ ok: false, error: 'Title and description required.' });

        const today = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const slug  = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
        const filename = `${slug}-${Date.now()}`;

        const outputLine = output ? `Output: ${output}` : '';
        const content = [
          `# Task: ${title}`,
          `Created: ${today}`,
          outputLine,
          '',
          '## Task',
          '',
          desc
        ].filter(l => l !== undefined).join('\n');

        const path = `Tasks/inbox/${filename}.md`;
        const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${encodeURIComponent(path)}`;

        const res = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            Authorization: `token ${env.GITHUB_TOKEN}`,
            'User-Agent': 'task-dispatch',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `[task-dispatch] ${today} — ${title}`,
            content: btoa(unescape(encodeURIComponent(content)))
          })
        });

        if (!res.ok) {
          const err = await res.text();
          return Response.json({ ok: false, error: `GitHub write failed: ${res.status}` });
        }

        return Response.json({ ok: true });
      } catch (err) {
        return Response.json({ ok: false, error: err.message });
      }
    }

    return new Response('Not found', { status: 404 });
  }
};
```

Set secrets and deploy:

```bash
wrangler secret put GITHUB_TOKEN
# their GitHub token (repo scope)

wrangler secret put GITHUB_REPO
# username/repo-name

wrangler deploy
```

Copy the worker URL. In Safari on their phone: open the URL → Share → Add to Home Screen. It becomes a task dispatch button on their home screen.

Test it: open the form, type a task, submit. Within 15 minutes (next vault-sync + next task-runner cycle), the task should appear in `Tasks/inbox/`, get processed, and land in the vault.

---

## Verify

Four checks before calling it done:

1. **Manual run works** — `~/bin/task-runner.sh` picks up a test task, result appears in vault, task moves to `Tasks/done/`
2. **LaunchAgent is loaded** — `launchctl list | grep task-runner` prints a line
3. **Timed run works** — wait up to 10 minutes, drop another task in inbox, confirm it runs without manual invocation
4. **Log is readable** — `cat ~/Library/Logs/task-runner.log | tail -20` shows clean output with timestamps
5. **(If phone dispatch)** — submit a task from the web form, confirm it appears in vault inbox and gets processed

---

## Hand off

End with:

> "Your agent swarm is running. Here's what you have:
>
> - **Inbox:** `[VaultName]/Tasks/inbox/` — drop a `.md` task file here, the runner handles it
> - **Runner:** checks every 10 minutes, runs the task with Claude Code, writes results to your vault
> - **Log:** `cat ~/Library/Logs/task-runner.log | tail -20`
> [If phone dispatch:] - **Phone:** open `[worker URL]` on your phone — Add to Home Screen for one-tap task dispatch
>
> **To send a task:** copy a template from `Tasks/templates/`, fill in the title, description, and output path, and save it to `Tasks/inbox/`. Or use the phone form.
>
> **What the agent can do:** anything Claude Code can do in your vault or repos — research, writing, summarization, code changes. What it can't do: real-time web browsing, sending emails, interacting with external services.
>
> **When tasks fail:** check `Tasks/errors/` and the log. Most failures are: task description too vague (Claude didn't know what to do), wrong Repo path, or a git conflict in the vault.
>
> **What's next:** You now have all four layers. Use the system for a while — let it prove its value, and come back when you have a backlog of tasks you wish ran automatically.
>
> One question before you go: **will this ever need a second machine?** If tasks start piling up, you need things to run while your Mac is closed, or you want a machine that's always on — that's Layer 5. It covers Tailscale (secure access between your machines) and `screen`/tmux (keeping a session alive across disconnects). Most people don't need this yet. If and when you do, paste `Layer-5-Multi-Machine.md` into a Claude Code session."

---

## Builder notes

- **`claude -p` requires Claude Code to be authenticated.** If the runner fires unattended and Claude Code's auth has expired, tasks will fail. Check that `claude -p "test"` works from a fresh Terminal before relying on the LaunchAgent.
- **PATH in LaunchAgents is minimal.** The plist inherits a minimal PATH — it won't find `claude` if it's only available via nvm or a shell alias. Find the full path with `which claude` in Terminal and hardcode it in the script as `CLAUDE="/full/path/to/claude"`.
- **Tasks run in the working directory.** If the task says `Repo: ~/my-project`, Claude Code runs there and has access to those files. If a task involves the vault, the default is fine.
- **Git state must be clean before the runner commits.** If vault-sync ran mid-task and left a conflict, the runner's commit will fail. The script does `git pull` at startup — this handles most cases, but a merge conflict will require manual resolution.
- **One task at a time.** The runner processes tasks serially. If a task takes 5 minutes, the next task waits. This is fine for most research/writing tasks. Parallel execution is an advanced topic for when the workload warrants it.
- **Task descriptions should be self-contained.** Claude Code in headless mode starts fresh with no conversation history. Include all context in the task file itself — don't assume it "knows" something from a previous session.
- **Multi-machine is Layer 5, not this layer.** When one Mac isn't enough — tasks piling up, need to run while Mac is closed, need a machine that's always on — the next step is a second machine reached over Tailscale, with `screen`/tmux keeping sessions alive across disconnects. Ask the closing question, don't build it here.
