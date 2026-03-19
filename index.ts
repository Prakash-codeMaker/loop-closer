/**
 * Loop Closer — iMessage agent
 * Text it your open loops. It follows up until they're closed.
 *
 * Setup:
 *   1. cp .env.example .env && fill in ANTHROPIC_API_KEY and YOUR_PHONE_NUMBER
 *   2. bun install
 *   3. Grant Full Disk Access to Terminal/Bun in System Settings
 *   4. bun run src/index.ts
 */

import { IMessageSDK } from "@photon-ai/imessage-kit";
import {
  addLoop,
  closeLoopByText,
  getDueFollowUps,
  getOpenLoops,
  getStats,
  markFollowUpSent,
  snoozeLoop,
  wakeExpiredSnoozes,
} from "./memory.js";
import {
  HELP_TEXT,
  formatLoopList,
  formatStats,
  generateFollowUp,
  parseIntent,
} from "./brain.js";

// ── Config ────────────────────────────────────────────────────────────────────

const YOUR_NUMBER = process.env.YOUR_PHONE_NUMBER;
if (!YOUR_NUMBER) throw new Error("Set YOUR_PHONE_NUMBER in .env");
if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY in .env");

// How often to check for due follow-ups (ms)
const FOLLOW_UP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

// ── SDK init ──────────────────────────────────────────────────────────────────

const sdk = new IMessageSDK({
  debug: process.env.DEBUG === "true",
  watcher: {
    pollInterval: 3000,
    unreadOnly: false,
    excludeOwnMessages: true,
  },
});

// ── Message handler ───────────────────────────────────────────────────────────

async function handleMessage(sender: string, text: string) {
  // Only respond to the owner's number
  const normalizedSender = sender.replace(/\D/g, "").replace(/^1/, "");
  const normalizedOwner = YOUR_NUMBER!.replace(/\D/g, "").replace(/^1/, "");

  if (normalizedSender !== normalizedOwner) {
    console.log(`[loop-closer] Ignoring message from ${sender}`);
    return;
  }

  console.log(`[loop-closer] Received: "${text}"`);

  // Wake any snoozed loops that are due
  wakeExpiredSnoozes();
  const openLoops = getOpenLoops();

  let reply: string;

  try {
    const intent = await parseIntent(text, openLoops);
    console.log(`[loop-closer] Intent:`, intent);

    switch (intent.type) {
      case "add_loop": {
        const loop = addLoop(intent.text, intent.tags);
        reply = `🔁 Added: "${intent.text}"\nI'll check back in 24h if it's still open.`;
        break;
      }

      case "close_loop": {
        const closed = closeLoopByText(intent.matchText);
        if (closed) {
          const ageMs = Date.now() - new Date(closed.createdAt).getTime();
          const ageH = Math.round(ageMs / (1000 * 60 * 60));
          const ageFmt = ageH >= 24 ? `${Math.round(ageH / 24)}d` : `${ageH}h`;
          reply = `✅ Closed: "${closed.text}" (took ${ageFmt})\n${openLoops.length - 1} loop${openLoops.length - 1 !== 1 ? "s" : ""} remaining.`;
        } else {
          reply = `Hmm, I couldn't find a matching open loop. Reply 'list' to see what's open.`;
        }
        break;
      }

      case "list_loops": {
        reply = await formatLoopList(openLoops);
        break;
      }

      case "snooze_loop": {
        // Find best match and snooze it
        const lower = intent.matchText.toLowerCase();
        const match = openLoops.find((l) =>
          l.text.toLowerCase().split(" ").some(
            (w) => w.length > 3 && lower.includes(w)
          )
        );
        if (match) {
          snoozeLoop(match.id, intent.hours);
          const wakeAt = new Date(Date.now() + intent.hours * 60 * 60 * 1000);
          const wakeStr = wakeAt.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            weekday: intent.hours >= 24 ? "short" : undefined,
          });
          reply = `💤 Snoozed: "${match.text}"\nI'll ping you again ${intent.hours >= 24 ? `${wakeStr}` : `in ${intent.hours}h`}.`;
        } else {
          reply = `Couldn't find that loop. Reply 'list' to see what's open.`;
        }
        break;
      }

      case "stats": {
        const stats = getStats();
        reply = formatStats(stats);
        break;
      }

      case "help": {
        reply = HELP_TEXT;
        break;
      }

      case "chitchat": {
        reply = intent.reply;
        break;
      }

      default:
        reply = `Not sure what you meant. Reply 'help' to see what I can do.`;
    }
  } catch (err) {
    console.error("[loop-closer] Error handling message:", err);
    reply = "Something went wrong on my end — try again in a sec.";
  }

  await sdk.send(YOUR_NUMBER!, reply);
  console.log(`[loop-closer] Sent reply: "${reply}"`);
}

// ── Follow-up scheduler ───────────────────────────────────────────────────────

async function checkFollowUps() {
  wakeExpiredSnoozes();
  const dueLoops = getDueFollowUps();

  for (const loop of dueLoops) {
    try {
      const message = await generateFollowUp(loop);
      await sdk.send(YOUR_NUMBER!, message);
      markFollowUpSent(loop.id);
      console.log(`[loop-closer] Follow-up sent for loop: "${loop.text}"`);
    } catch (err) {
      console.error(`[loop-closer] Error sending follow-up for ${loop.id}:`, err);
    }
    // Brief pause between follow-ups to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔁 Loop Closer starting up...");
  console.log(`   Listening for messages from ${YOUR_NUMBER}`);

  // Send a startup confirmation
  await sdk.send(
    YOUR_NUMBER!,
    `Loop Closer is running 🟢\nText me anything you need to finish and I'll follow up until it's done.\nReply 'help' to see how it works.`
  );

  // Watch for incoming messages
  await sdk.startWatching({
    onDirectMessage: async (msg) => {
      if (msg.text) {
        await handleMessage(msg.sender, msg.text);
      }
    },
    onError: (error) => {
      console.error("[loop-closer] Watcher error:", error);
    },
  });

  // Run follow-up check on startup, then on interval
  await checkFollowUps();
  setInterval(checkFollowUps, FOLLOW_UP_INTERVAL_MS);

  console.log("✅ Loop Closer is running. Press Ctrl+C to stop.");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n[loop-closer] Shutting down...");
    sdk.stopWatching();
    await sdk.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[loop-closer] Fatal error:", err);
  process.exit(1);
});
