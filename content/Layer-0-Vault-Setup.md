# Layer 0 — Vault Setup
## Builder Agent Prompt

**How to use this:** Paste the contents of this file into a Claude Code session on your Mac. Claude will interview you, then build your vault. You don't need to know how to code — just answer the questions.

---

You are setting up a personal knowledge system for someone starting from scratch. Your job is to interview them one question at a time, understand their setup and goals, then build a working vault — a structured Obsidian notebook backed up to GitHub that forms the foundation for everything that comes after.

**Pre-flight:** Before the interview begins, verify Claude Code is installed and authenticated. Run through the checklist below. Do not skip this — if Claude Code isn't working, nothing else will be either.

---

## Pre-flight — Claude Code setup

### Step 0 — Pick a terminal (do this first)

A "terminal" is just the app where you type commands. Your Mac comes with one called **Terminal** (in Applications → Utilities) and it works perfectly fine. But if you want a friendlier, more modern experience — especially if this is new to you — install one of these instead:

- **[Warp](https://warp.dev)** *(recommended for newcomers)* — clean, modern, and has AI help built right in. The easiest place to start.
- **[iTerm2](https://iterm2.com)** — a longtime favorite, very capable.
- **Terminal** (already on your Mac) — no install needed; totally fine if you'd rather not add anything.

Pick one and open it. Everywhere this curriculum says "open Terminal" or "run this in Terminal," it means whichever one you chose — they all work the same way.

---

### Step 1 — Check if Claude Code is installed

Open your terminal and run:

```bash
claude --version
```

- **Prints a version number:** you're good. Skip to Step 3.
- **"command not found":** continue to Step 2.

---

### Step 2 — Install Claude Code

First check for Node.js:

```bash
node --version
```

- **Prints a version:** run `npm install -g @anthropic-ai/claude-code` and skip to Step 3.
- **"command not found":** you need Homebrew and Node first.

Install Homebrew (paste this into Terminal):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

It will ask for your Mac login password — the one you use to unlock your computer. Terminal won't show anything while you type it; that's normal. Hit Enter when done.

Then install Node and Claude Code:

```bash
brew install node
npm install -g @anthropic-ai/claude-code
```

---

### Step 3 — Log in to Claude Code

Run:

```bash
claude
```

The first time, it will open a browser and ask you to log in with your Anthropic account. Complete the login, then return to Terminal.

Once you see a Claude Code prompt (`>`), you're authenticated. Type `/exit` to close it for now — we'll use it properly in a moment.

---

### Step 4 — Two tricks that make this 10x faster

You'll move through this whole tutorial faster if you know these two things up front. They're the difference between fighting the tools and flying through them.

**1. Copy and paste are your best friends.** Almost everything in this tutorial — commands, file contents, this whole document — is meant to be copied and pasted, not typed by hand. On a Mac:
- **Copy:** `Cmd+C`
- **Paste:** `Cmd+V`
- In Terminal specifically, paste also works with `Cmd+V` (you don't need the older `Cmd+Shift+V`).

Don't retype commands — you'll make typos and waste time. Highlight, copy, paste, Enter.

**2. Screenshots are a superpower with Claude.** This is the big one. Any time you're stuck on a screen — a confusing settings page, a button you can't find, an error you don't understand, a website that doesn't look like what the tutorial described — you don't have to describe it in words. **Take a screenshot and paste it straight into Claude Code.** Claude can see the image and tell you exactly what to click.

- **Screenshot a region:** `Cmd+Shift+4`, then drag a box around what you want. It saves to your Desktop.
- **Screenshot the whole screen:** `Cmd+Shift+3`.
- **Paste it into Claude:** drag the image file into the Claude Code terminal, or copy the image (`Cmd+Shift+4` then hold `Control` while dragging copies it to clipboard) and paste with `Cmd+V`.

When in doubt, screenshot it and ask "what do I do here?" — it's almost always faster than typing out a description. Get in the habit of this now; you'll use it constantly.

---

### Step 5 — Paste this file

You're now ready. In a new Claude Code session, paste the entire contents of this file. Claude will take it from here.

---

**Interview protocol:** Ask questions ONE AT A TIME. Wait for each answer before asking the next. Do not list all questions upfront. Do not start building until the interview is complete. If the person is not technical, explain what each step does before doing it.

**Tone:** Conversational and encouraging. This is someone building something meaningful for themselves. Make them feel like the system is theirs, not a generic template.

---

## Interview

### Q1 — Introduction

Open with:

> "I'm going to ask you a few questions to understand what you need, then I'll build your vault. First — what's your name, and what do you do?"

Their answer shapes how you personalize everything downstream. Someone managing a sales territory needs different structure than someone running creative projects. Listen for what they care about.

---

### Q2 — Goals

> "What are you hoping this system helps you with? What's the main problem you're trying to solve?"

This tells you whether the vault is primarily a work tool, a personal tool, or both. It shapes the folder structure and will help you write a personalized CLAUDE.md that reflects their actual context.

---

### Q3 — Obsidian

> "Do you have Obsidian installed on your Mac?"

- **Yes:** continue
- **No:** "Let's get that first. Go to obsidian.md, download the Mac version, and install it. It's free. Come back when it's done — I'll wait."

---

### Q4 — GitHub

> "Do you have a GitHub account?"

**Explain it first — don't assume they know what GitHub is.** Use an analogy: "GitHub is like a cloud backup with a built-in time machine. Every time your notes save, it keeps a copy online *and* remembers every past version — so you can never really lose your work, and you can always rewind. It's also how the AI tools you add in later layers will read your vault. Think of it as the safety net under everything we build."

- **Yes:** continue to the gh CLI check below
- **No:** "You'll need a free account at github.com — it's free and takes about two minutes to create. Come back once you've signed up."

Once they have an account, check for the GitHub CLI:

> "One more thing — do you have the GitHub CLI installed? You can check by opening Terminal and typing `which gh`. If it prints a path, you're good. If it says 'not found,' let me know and I'll install it."

- **Not installed:** `brew install gh` then `gh auth login` and walk them through the browser authentication step.

---

### Q5 — Your world

> "Now the fun part — what's your world made of? What do you actually care about and want to keep track of? Don't overthink it. It can be the stuff you're into (music, sports, gaming, a side hustle, your friends) *and* the stuff you're juggling (school, work, money) — whatever's actually *yours*. Name as many as feel right; 4 to 7 is a good range."

These become the top-level folders in their vault and organize everything in later layers.

**Match their energy — this is the big one for younger or more casual people.** Don't lead with a formal list of "responsibilities." Lead with what they're *into*, and let the practical stuff come along naturally. The goal is for them to feel like this system is being built around *their* life and interests, not handed a productivity chore. Tailor your examples to them:
- A student or creative might land on: "Music, Soccer, School, Film projects, Money, Friends."
- A professional might land on: "Work, Health, Family, Finances, Learning."

Both are perfect. Any answer works and can be changed anytime — reassure them there's no wrong list.

---

### Q6 — Vault name

> "What should your vault be called? This becomes the folder name on your Mac and your GitHub repository name. Something simple works best — like 'My Notes', '[Name] Brains', or just your name."

Confirm the name makes sense as a folder and GitHub repo slug (lowercase, hyphens instead of spaces for the repo — you'll handle the conversion).

---

### Q7 — Other machines

> "Do you regularly use any other computers — like a Windows machine at work?"

- **Yes:** note this. You'll add a Windows access step at the end of the build.
- **No:** continue.

---

## Confirm before building

Before writing any files, summarize what you're about to create:

> "Here's what I'm going to set up:
> - Vault called **[VaultName]** at `~/[VaultName]/` on your Mac
> - Folders for: [list their life areas]
> - GitHub repository: `[username]/[repo-name]` (private)
> - Auto-sync every 15 minutes — your notes will always be backed up
>
> Does that look right?"

Wait for a yes before continuing.

---

## Build

Work through each step in order. Show the person what you're doing as you go — one sentence per step is enough. If anything fails, debug it before moving on.

### Step 1 — Create the vault folder

```bash
mkdir -p ~/[VaultName]
cd ~/[VaultName]
```

Create folders for each life area they named, plus the standard vault structure:

```bash
# Standard structure
mkdir -p "Daily Notes" Projects Archives "_Templates" Resources

# One folder per life area they named (adapt to their actual words)
# e.g.: mkdir -p Work Health Family Finances Learning
```

---

### Step 2 — Create Home.md

This is their entry point — the first file they'll see when they open Obsidian.

```markdown
# [Name]'s Vault

*Your second brain.*

## Areas
[Link to each life area folder they named]

## This week
- [[focus]] — what you're working on right now

## Daily
- [[Daily Notes/]] — one note per day

## Resources
- [[Resources/]] — reference material, research, saved notes
```

---

### Step 3 — Create focus.md

```markdown
# This Week

*Update this Monday morning. One sentence per item.*

## Focus
- 

## In flight
- 

## Waiting on
- 
```

---

### Step 4 — Create CLAUDE.md

This tells any AI agent that works in the vault who the person is and how the vault is structured. Write it based on what they told you in the interview — not generic filler.

```markdown
# CLAUDE.md — [Name]'s Vault

This is [Name]'s personal knowledge vault.

## About [Name]
[One or two sentences from their Q1 and Q2 answers — what they do and what this system is for.]

## Vault structure
| Folder | What lives here |
|---|---|
| `Daily Notes/` | One note per day |
| `Projects/` | Active project notes |
| `Archives/` | Older notes and completed work |
| `Resources/` | Reference material and research |
| `[Life area]/` | [What goes here — one row per area they named] |

## Commit convention
When creating or editing files in this vault:
```bash
git add .
git commit -m "[claude-code] YYYY-MM-DD — what was done"
git push
```
```

---

### Step 5 — Create .gitignore

```
.DS_Store
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/cache
```

---

### Step 6 — Initialize git and create GitHub repo

**Explain `commit` with an analogy as you do it:** "A `commit` is like a save point in a video game — a snapshot of your work at this exact moment. You can always jump back to any save point. We're making your first one right now."

```bash
cd ~/[VaultName]
git init
git add .
git commit -m "[vault] initial setup — [Name]'s vault"
```

Create the private GitHub repo and push:

```bash
# Convert vault name to a repo slug (lowercase, hyphens)
# e.g. "Ben Brains" → "ben-brains"
gh repo create [repo-slug] --private --source=. --remote=origin --push
```

Confirm the push succeeded — open the GitHub URL it prints and show them their vault is there.

---

### Step 7 — Create the sync script `[Mac only]`

This script runs every 15 minutes and backs up any new notes to GitHub automatically.

**Explain it with an analogy:** "We're about to set up an automatic assistant — like a recurring alarm that goes off every 15 minutes, except instead of waking you up, it quietly backs up your notes to the cloud. You'll never have to remember to save. It just happens in the background, forever."

```bash
mkdir -p ~/bin
```

Write `~/bin/vault-sync.sh` with the vault path filled in:

```bash
#!/bin/bash
VAULT="$HOME/[VaultName]"
LOG="$HOME/Library/Logs/vault-sync.log"
cd "$VAULT" || exit 1
git pull --quiet 2>>"$LOG"
git add . 2>>"$LOG"
git diff --cached --quiet || git commit -m "[vault] auto-sync $(date '+%Y-%m-%d %H:%M')" 2>>"$LOG"
git push --quiet 2>>"$LOG"
```

```bash
chmod +x ~/bin/vault-sync.sh
```

---

### Step 8 — Set up auto-sync `[Mac only]`

Determine their Mac username:

```bash
whoami
```

Write `~/Library/LaunchAgents/com.[repo-slug].sync.plist` with their actual username and vault name filled in:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.[repo-slug].sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/[username]/bin/vault-sync.sh</string>
  </array>
  <key>StartInterval</key>
  <integer>900</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/[username]/Library/Logs/vault-sync.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/[username]/Library/Logs/vault-sync.log</string>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.[repo-slug].sync.plist
```

Confirm it loaded:

```bash
launchctl list | grep [repo-slug]
```

It should print a line with the label. If it doesn't, check the plist for typos and try again.

---

### Step 9 — Open in Obsidian

Guide them to:
1. Open Obsidian
2. Click **Open folder as vault**
3. Navigate to `~/[VaultName]` and select it
4. Open `Home.md`

Tell them: "That's your home base. Click around — your folders are all there. The system will auto-sync every 15 minutes from here on."

---

## Windows bridge (if applicable)

If they said yes in Q7, add this step:

> "You mentioned you also use a Windows machine. Here's how to access your vault from there — takes about 5 minutes, and you don't need to set up any automation on Windows. The Mac handles all of that.
>
> On your Windows machine:
> 1. Install Obsidian from obsidian.md
> 2. Install Git for Windows from git-scm.com
> 3. Open Git Bash (it comes with Git) and run:
>    `git clone https://github.com/[username]/[repo-slug].git`
> 4. Open Obsidian → Open folder as vault → navigate to the cloned folder
>
> That's it. You can read and write notes from your Windows machine. Your Mac will pull them in automatically on its next sync. All automation — the auto-backup, and any AI tools added in later layers — runs only on your Mac."

---

## Verify

Run a test sync to confirm everything is wired:

```bash
cd ~/[VaultName]
echo "test" > "test-sync-$(date +%Y-%m-%d).md"
~/bin/vault-sync.sh
```

Wait a few seconds, then check the GitHub repo in the browser — the test file should appear. Then clean it up:

```bash
rm ~/[VaultName]/test-sync-$(date +%Y-%m-%d).md
~/bin/vault-sync.sh
```

Show them the GitHub repo with the test file gone. The round trip is proven.

---

## Hand off

End with:

> "Your vault is live. Here's what you have:
> - Notes in Obsidian on your Mac
> - Auto-backup to GitHub every 15 minutes — you never lose anything
> [If Windows:] > - Read/write access from your Windows machine
>
> **To use it:** Open Obsidian, write notes in whatever folder makes sense, and let it sync automatically. Don't stress about the structure — the goal right now is just to have a place for things.
>
> **To check the sync log any time:**
> ```bash
> cat ~/Library/Logs/vault-sync.log
> ```
>
> **What's next:** Layer 1 builds a morning brief — an AI-written summary that arrives on a schedule and gets smarter the more you use it. When you're ready, paste `Layer-1-Morning-Brief.md` into a Claude Code session the same way you used this one."

---

## Builder notes

- **Fill in every placeholder** before showing output — `[VaultName]`, `[Name]`, `[username]`, `[repo-slug]`. Generic placeholders are a failure mode.
- **Debug before moving on.** If git push fails, if the LaunchAgent won't load, if Obsidian can't find the folder — fix it before calling the step done.
- **The sync log** is the first thing to check when something seems off: `cat ~/Library/Logs/vault-sync.log`
- **Homebrew** (`brew`) is assumed available on Mac. If not installed, it's a prerequisite: `https://brew.sh`
- **This is Layer 0 of 4.** Nothing built in later layers requires changing anything built here. The vault structure may grow, but the foundation stays the same.
