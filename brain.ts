import Anthropic from "@anthropic-ai/sdk";
import type { Loop } from "./memory.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type Intent =
  | { type: "add_loop"; text: string; tags: string[] }
  | { type: "close_loop"; matchText: string }
  | { type: "list_loops" }
  | { type: "snooze_loop"; matchText: string; hours: number }
  | { type: "stats" }
  | { type: "help" }
  | { type: "chitchat"; reply: string };

/** Parse the user's raw message into a structured intent */
export async function parseIntent(
  userMessage: string,
  openLoops: Loop[]
): Promise<Intent> {
  const loopsSummary =
    openLoops.length > 0
      ? openLoops
          .slice(0, 10)
          .map((l, i) => `${i + 1}. [${l.id}] ${l.text}`)
          .join("\n")
      : "No open loops.";

  const prompt = `You are the brain of a personal "Loop Closer" iMessage agent. Your job is to figure out what the user wants and return ONLY valid JSON.

CURRENT OPEN LOOPS:
${loopsSummary}

USER MESSAGE: "${userMessage}"

Classify the user's intent into ONE of these JSON shapes:

1. Adding a new open loop / task / thing to track:
   {"type":"add_loop","text":"<clean description of the loop>","tags":["<tag1>","<tag2>"]}
   Tags can be things like: work, personal, email, call, reply, review, fix, buy, people names prefixed with "person:" etc.

2. Closing / marking done a loop (they say done/finished/replied/sent/completed etc.):
   {"type":"close_loop","matchText":"<key words to identify which loop>"}

3. Listing open loops:
   {"type":"list_loops"}

4. Snoozing a loop (remind me later, not today, etc.):
   {"type":"snooze_loop","matchText":"<key words>","hours":<number, e.g. 24 for tomorrow, 4 for later today>}

5. Asking for stats / close rate / history:
   {"type":"stats"}

6. Asking for help / what can you do:
   {"type":"help"}

7. Anything else (chitchat, unclear):
   {"type":"chitchat","reply":"<a warm, brief reply as Loop Closer>"}

RULES:
- Return ONLY the JSON object, no markdown, no explanation.
- If the message sounds like adding multiple loops, pick the clearest one; the user can add more.
- Be liberal about recognizing "I did X", "X is done", "replied to X" as close_loop intents.
- Tags should be lowercase, no spaces (use hyphens).`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";

  try {
    return JSON.parse(raw) as Intent;
  } catch {
    return { type: "chitchat", reply: "I didn't quite catch that — try 'add a loop', 'list my loops', or 'mark X as done'." };
  }
}

/** Generate a human-feeling follow-up nudge for an open loop */
export async function generateFollowUp(loop: Loop): Promise<string> {
  const ageHours = Math.round(
    (Date.now() - new Date(loop.createdAt).getTime()) / (1000 * 60 * 60)
  );
  const ageFmt =
    ageHours < 24
      ? `${ageHours}h ago`
      : `${Math.round(ageHours / 24)} day${ageHours > 48 ? "s" : ""} ago`;

  const prompt = `You're a helpful, gently persistent personal assistant texting via iMessage. 
The user added this open loop ${ageFmt}: "${loop.text}"
This is follow-up #${loop.followUpCount + 1}.

Write a SHORT follow-up text (1-2 sentences max) that:
- Feels like a friend checking in, not a task manager
- Mentions the loop naturally
- Gets slightly more direct on higher follow-up counts (${loop.followUpCount + 1})
- Ends with a tiny nudge or question
- No emojis overload — at most one
- DO NOT start with "Hey" or "Hi"

Return only the message text.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 100,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text.trim() : `Still open: "${loop.text}" — any movement on this?`;
}

/** Format a nice list of open loops for display */
export async function formatLoopList(loops: Loop[]): Promise<string> {
  if (loops.length === 0) {
    return "✅ You're clear — no open loops. Nice.";
  }

  const lines = loops.map((l, i) => {
    const ageMs = Date.now() - new Date(l.createdAt).getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    const ageFmt = ageDays > 0 ? `${ageDays}d` : `${ageHours}h`;
    const oldFlag = ageDays >= 3 ? " 🔴" : ageDays >= 1 ? " 🟡" : " 🟢";
    return `${i + 1}. ${l.text} (${ageFmt} old)${oldFlag}`;
  });

  const header = `📋 ${loops.length} open loop${loops.length > 1 ? "s" : ""}:\n`;
  return header + lines.join("\n") + "\n\nReply 'done [#]' to close one, or 'snooze [#]' to push it out.";
}

/** Format a stats summary */
export function formatStats(stats: {
  totalOpened: number;
  totalClosed: number;
  avgHoursToClose: number;
  longestOpenDays: number;
}): string {
  if (stats.totalOpened === 0) {
    return "No loops tracked yet — text me something you need to get done.";
  }

  const closeRate =
    stats.totalOpened > 0
      ? Math.round((stats.totalClosed / stats.totalOpened) * 100)
      : 0;

  const avgFmt =
    stats.avgHoursToClose > 24
      ? `${Math.round(stats.avgHoursToClose / 24)}d`
      : `${stats.avgHoursToClose}h`;

  const grade =
    closeRate >= 80
      ? "S"
      : closeRate >= 60
      ? "A"
      : closeRate >= 40
      ? "B"
      : closeRate >= 20
      ? "C"
      : "D";

  return [
    `📊 Your Loop Stats:`,
    `• Opened: ${stats.totalOpened} • Closed: ${stats.totalClosed}`,
    `• Close rate: ${closeRate}% (grade: ${grade})`,
    `• Avg time to close: ${avgFmt}`,
    stats.longestOpenDays > 0
      ? `• Oldest open loop: ${stats.longestOpenDays} days`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const HELP_TEXT = `Loop Closer 🔁 — your open loop tracker

HOW IT WORKS:
Text me anything you need to finish. I'll remember it and follow up until you mark it done.

COMMANDS:
• Add: just describe it — "Need to reply to Sarah's email"
• Close: "Done with Sarah's email" or "replied to Sarah" 
• List: "list" or "what's open"
• Snooze: "snooze Sarah email til tomorrow"
• Stats: "stats" or "how am I doing"

I follow up at 24h → 48h → 72h → weekly intervals. You'll hear from me if something's been sitting too long.`;
