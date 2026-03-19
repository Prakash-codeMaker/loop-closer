import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type LoopStatus = "open" | "closed" | "snoozed";

export interface Loop {
  id: string;
  text: string; // Original description
  createdAt: string; // ISO string
  updatedAt: string;
  status: LoopStatus;
  followUpCount: number;
  nextFollowUp: string | null; // ISO string
  closedAt: string | null;
  snoozeUntil: string | null;
  tags: string[]; // AI-extracted tags e.g. ["work", "email", "person:Sarah"]
}

export interface Stats {
  totalOpened: number;
  totalClosed: number;
  avgHoursToClose: number;
  longestOpenDays: number;
}

interface Store {
  loops: Loop[];
  lastActivity: string;
}

const DATA_PATH = join(process.cwd(), "data", "loops.json");

function ensureDataDir() {
  const { mkdirSync } = require("node:fs");
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function load(): Store {
  ensureDataDir();
  if (!existsSync(DATA_PATH)) {
    return { loops: [], lastActivity: new Date().toISOString() };
  }
  return JSON.parse(readFileSync(DATA_PATH, "utf-8")) as Store;
}

function save(store: Store) {
  ensureDataDir();
  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function addLoop(
  text: string,
  tags: string[],
  followUpHours = 24
): Loop {
  const store = load();
  const now = new Date();
  const nextFollowUp = new Date(now.getTime() + followUpHours * 60 * 60 * 1000);

  const loop: Loop = {
    id: `loop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: "open",
    followUpCount: 0,
    nextFollowUp: nextFollowUp.toISOString(),
    closedAt: null,
    snoozeUntil: null,
    tags,
  };

  store.loops.push(loop);
  store.lastActivity = now.toISOString();
  save(store);
  return loop;
}

export function getOpenLoops(): Loop[] {
  const store = load();
  return store.loops.filter((l) => l.status === "open");
}

export function getAllLoops(): Loop[] {
  return load().loops;
}

export function closeLoop(id: string): Loop | null {
  const store = load();
  const loop = store.loops.find((l) => l.id === id);
  if (!loop) return null;

  loop.status = "closed";
  loop.closedAt = new Date().toISOString();
  loop.updatedAt = new Date().toISOString();
  loop.nextFollowUp = null;
  save(store);
  return loop;
}

export function closeLoopByText(fuzzyText: string): Loop | null {
  const store = load();
  const open = store.loops.filter((l) => l.status === "open");
  const lower = fuzzyText.toLowerCase();

  // Simple fuzzy: find loop whose text shares the most words
  let best: Loop | null = null;
  let bestScore = 0;

  for (const loop of open) {
    const words = lower.split(/\s+/);
    const loopWords = loop.text.toLowerCase().split(/\s+/);
    const shared = words.filter((w) => w.length > 3 && loopWords.includes(w)).length;
    if (shared > bestScore) {
      bestScore = shared;
      best = loop;
    }
  }

  if (best && bestScore > 0) {
    best.status = "closed";
    best.closedAt = new Date().toISOString();
    best.updatedAt = new Date().toISOString();
    best.nextFollowUp = null;
    save(store);
    return best;
  }
  return null;
}

export function snoozeLoop(id: string, hours: number): Loop | null {
  const store = load();
  const loop = store.loops.find((l) => l.id === id);
  if (!loop) return null;

  const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  loop.status = "snoozed";
  loop.snoozeUntil = snoozeUntil.toISOString();
  loop.nextFollowUp = snoozeUntil.toISOString();
  loop.updatedAt = new Date().toISOString();
  save(store);
  return loop;
}

export function markFollowUpSent(id: string, nextFollowUpHours = 24): void {
  const store = load();
  const loop = store.loops.find((l) => l.id === id);
  if (!loop) return;

  loop.followUpCount += 1;
  loop.updatedAt = new Date().toISOString();

  // Back off follow-up intervals: 24h, 48h, 72h, then weekly
  const delays = [24, 48, 72, 168];
  const delayH = delays[Math.min(loop.followUpCount, delays.length - 1)];
  loop.nextFollowUp = new Date(Date.now() + delayH * 60 * 60 * 1000).toISOString();
  save(store);
}

export function getDueFollowUps(): Loop[] {
  const store = load();
  const now = new Date();
  return store.loops.filter(
    (l) =>
      l.status === "open" &&
      l.nextFollowUp &&
      new Date(l.nextFollowUp) <= now &&
      l.followUpCount < 10 // Don't pester forever
  );
}

export function getStats(): Stats {
  const loops = getAllLoops();
  const closed = loops.filter((l) => l.status === "closed");

  let totalHours = 0;
  let maxDays = 0;

  for (const l of closed) {
    if (l.closedAt) {
      const hours =
        (new Date(l.closedAt).getTime() - new Date(l.createdAt).getTime()) /
        (1000 * 60 * 60);
      totalHours += hours;
    }
  }

  const openLoops = loops.filter((l) => l.status === "open");
  for (const l of openLoops) {
    const days =
      (Date.now() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (days > maxDays) maxDays = days;
  }

  return {
    totalOpened: loops.length,
    totalClosed: closed.length,
    avgHoursToClose: closed.length ? Math.round(totalHours / closed.length) : 0,
    longestOpenDays: Math.round(maxDays),
  };
}

export function wakeExpiredSnoozes(): void {
  const store = load();
  const now = new Date();
  for (const loop of store.loops) {
    if (
      loop.status === "snoozed" &&
      loop.snoozeUntil &&
      new Date(loop.snoozeUntil) <= now
    ) {
      loop.status = "open";
      loop.snoozeUntil = null;
    }
  }
  save(store);
}
