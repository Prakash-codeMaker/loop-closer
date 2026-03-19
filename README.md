# Loop Closer 🔁

**Text it your unfinished things. It won't let you forget them.**

An iMessage-native agent built with [Photon iMessage Kit](https://github.com/photon-hq/imessage-kit) + Claude. Text it open loops — tasks, replies, things to do — and it follows up until you mark them done. No app, no dashboard, no new habit. Just your existing Messages thread.

---

## The Idea

We all have a graveyard of half-finished things: the email we meant to reply to, the PR that needed one more pass, the friend we said we'd call. Loop Closer is the persistent, non-judgmental friend who just keeps asking *"hey, did you ever do that thing?"* — until you did.

---

## Example Conversation

```
You           Need to reply to Marcus about the contract
Loop Closer   🔁 Added: "Reply to Marcus about the contract"
              I'll check back in 24h if it's still open.

─── 24 hours later ────────────────────────────────────────

Loop Closer   Still sitting on Marcus's contract reply — any blockers,
              or just hasn't happened yet?

You           snooze that til tomorrow
Loop Closer   💤 Snoozed: "Reply to Marcus about the contract"
              I'll ping you again tomorrow.

─── next day ───────────────────────────────────────────────

Loop Closer   Marcus's contract reply has been open 2 days now.
              Worth 5 minutes today?

You           sent it finally
Loop Closer   ✅ Closed: "Reply to Marcus about the contract" (took 2d)
              3 loops remaining.

You           stats
Loop Closer   📊 Your Loop Stats:
              • Opened: 12  •  Closed: 9
              • Close rate: 75% (grade: A)
              • Avg time to close: 18h
              • Oldest open loop: 4 days
```

---

## Features

- **Natural language intake** — just describe the thing, no special syntax
- **Fuzzy close matching** — "done with Marcus" finds and closes the right loop
- **Smart follow-ups** — Claude writes contextual nudges, not generic pings
- **Backoff schedule** — 24h → 48h → 72h → weekly; persistent but not spammy
- **Snooze** — "snooze til tomorrow" or "remind me in 4 hours"
- **Stats + close rate** — track your follow-through over time
- **Owner-only** — only responds to your number, safe to leave running 24/7

---

## Setup

### Prerequisites

- macOS (iMessage Kit is macOS-only)
- [Bun](https://bun.sh) ≥ 1.0 (or Node.js ≥ 18)
- [Anthropic API key](https://console.anthropic.com)
- Full Disk Access granted to your terminal

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/loop-closer
cd loop-closer
bun install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
YOUR_PHONE_NUMBER=+1XXXXXXXXXX
```

### 3. Grant permissions

**System Settings → Privacy & Security → Full Disk Access** → add your terminal app (Terminal, iTerm2, Warp, etc.)

### 4. Run

```bash
bun run src/index.ts
```

You'll receive an iMessage confirming it's live. Start texting.

---

## Commands

| What you text | What happens |
|---|---|
| `"Need to review the design doc"` | Adds a new loop |
| `"done with design doc"` | Closes the matching loop |
| `"list"` | Shows all open loops with age |
| `"snooze design doc til tomorrow"` | Pushes the follow-up out |
| `"stats"` | Close rate, avg time to close, grade |
| `"help"` | Shows this command list |

---

## Architecture

```
loop-closer/
├── src/
│   ├── index.ts    # Entry point — wires SDK, message handler, follow-up scheduler
│   ├── brain.ts    # Claude — intent parsing + contextual nudge generation
│   └── memory.ts   # Persistence — JSON-backed loop store with CRUD + stats
├── data/
│   └── loops.json  # Your loops (gitignored, stays on your Mac)
└── .env.example
```

**Stack:**

| | |
|---|---|
| [`@photon-ai/imessage-kit`](https://github.com/photon-hq/imessage-kit) | iMessage send/receive on macOS |
| [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-python) | Claude `claude-sonnet-4-20250514` for intent parsing + writing follow-ups |
| JSON flat file | Zero-dependency persistence — easy to inspect, back up, or wipe |

---

## Privacy

All data stays on your Mac. `data/loops.json` is gitignored. The agent ignores messages from any number other than your own.

---

## License

MIT
