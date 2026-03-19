# Loop Closer 🔁

> Text it your unfinished things. It won't let you forget them.

An iMessage-native agent built with [Photon iMessage Kit](https://github.com/photon-hq/imessage-kit) and Claude. You text it open loops — tasks, replies, things to do — and it follows up until you mark them done. No app to open, no dashboard to check. Just your existing Messages thread.

---

## The Idea

We all have a graveyard of half-finished things: the email we meant to reply to, the PR that needed one more review, the friend we said we'd call. Loop Closer is the persistent, non-judgmental friend who just keeps asking *"hey, did you ever do that thing?"* until you did.

**One sentence:** Text it your open loops and it follows up until they're closed.

---

## Example Conversation

```
You:          Need to reply to Marcus about the contract
Loop Closer:  🔁 Added: "Reply to Marcus about the contract"
              I'll check back in 24h if it's still open.

— 24 hours later —

Loop Closer:  Still sitting on Marcus's contract reply — any blockers, or just hasn't happened yet?

You:          snooze that til tomorrow
Loop Closer:  💤 Snoozed: "Reply to Marcus about the contract"
              I'll ping you again tomorrow.

— next day —

Loop Closer:  Marcus's contract reply has been open 2 days now. Worth 5 minutes today?

You:          sent it finally
Loop Closer:  ✅ Closed: "Reply to Marcus about the contract" (took 2d)
              3 loops remaining.

You:          stats
Loop Closer:  📊 Your Loop Stats:
              • Opened: 12 • Closed: 9
              • Close rate: 75% (grade: A)
              • Avg time to close: 18h
              • Oldest open loop: 4 days
```

---

## Features

- **Natural language intake** — just describe the thing, no special syntax
- **Fuzzy close matching** — "done with Marcus" closes the right loop
- **Smart follow-ups** — Claude writes contextual nudges, not generic pings
- **Backoff schedule** — follows up at 24h → 48h → 72h → weekly (won't spam you)
- **Snooze** — "snooze til tomorrow", "remind me in 4 hours"
- **Stats + close rate** — track your follow-through over time
- **Owner-only** — only responds to your number, safe to leave running

---

## Setup

### Prerequisites

- macOS (iMessage Kit is macOS-only)
- [Bun](https://bun.sh) >= 1.0 (or Node.js >= 18)
- An [Anthropic API key](https://console.anthropic.com)
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
# Edit .env with your ANTHROPIC_API_KEY and YOUR_PHONE_NUMBER
```

### 3. Grant permissions

Open **System Settings → Privacy & Security → Full Disk Access** and add your terminal app (Terminal, iTerm2, Warp, etc.).

### 4. Run

```bash
bun run src/index.ts
```

You'll get an iMessage confirming it's running. Start texting it.

---

## Commands

| What you say | What happens |
|---|---|
| `"Need to review the design doc"` | Adds a new loop |
| `"done with design doc"` | Closes matching loop |
| `"list"` | Shows all open loops with age |
| `"snooze design doc til tomorrow"` | Pushes follow-up to tomorrow |
| `"stats"` | Close rate, avg time, grade |
| `"help"` | Shows this command list |

---

## Architecture

```
src/
├── index.ts    # Entry point — wires SDK, scheduler, message handler
├── brain.ts    # Claude integration — intent parsing + response generation
└── memory.ts   # Persistence — JSON-backed loop store with CRUD + stats

data/
└── loops.json  # Your loops (gitignored, stays on your machine)
```

**Stack:**
- `@photon-ai/imessage-kit` — iMessage send/receive
- `@anthropic-ai/sdk` — Claude claude-sonnet-4-20250514 for intent parsing + follow-up writing
- Zero database — flat JSON file, easy to inspect and back up

---

## Privacy

All data stays on your Mac. `data/loops.json` is gitignored. The agent only processes messages from your own phone number.

---

## License

MIT
