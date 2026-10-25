import { DAILY_CHALLENGES, dailyDayBounds, type DailyCompletionRecord } from "./daily-challenges";
import { isValidXpAward, type LocalXpLedger, type XpAward } from "./progression";

/** Dormant policies: all verification/finality/coverage claims must come from a
 * trusted backend. This module cannot authenticate them or issue persistent XP.
 * Complete history means from account creation, including genuinely missed days;
 * omission within that attested coverage means inactivity, NOT unknown history.
 * A backend must serialize progress/rewards atomically and reconcile corrections
 * to finalized history; never fill these contracts from UI clicks or demo data.
 */
const DAY = 86_400_000;
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.trim() === v;
const time = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 8.64e15;
type Proof = Readonly<{ eventId: string; occurredAt: number; verified: boolean; demo: boolean }>;
export type StreakActivity = Proof & Readonly<{
  type: "battle-completed" | "discover-listened" | "post-liked" | "comment-published" | "lobby-post-published";
  objectId: string;
  targetOwnerId: string;
  qualifying: boolean;
}>;
export type StreakDay = Readonly<{ accountId: string; dayKey: string; login: Proof | null; activities: readonly StreakActivity[] }>;
export type StreakHistory = Readonly<{
  accountId: string; accountCreatedDay: string; closedThroughDay: string;
  complete: boolean; days: readonly StreakDay[];
}>;
export type WeeklyHistory = Readonly<{
  accountId: string; weekKey: string; closedThroughDay: string;
  complete: boolean; records: readonly DailyCompletionRecord[];
}>;
export type PeriodDecision =
  | { status: "prepared"; award: XpAward | null; qualifyingDays: number }
  | { status: "invalid-history" | "incomplete-history" | "invalid-ledger" | "reconciliation-required" | "overflow" };

/** Monday date identifies [Monday 00:00 UTC, following Monday 00:00 UTC). */
export function utcWeek(dayKey: string) {
  const { start } = dailyDayBounds(dayKey);
  const monday = start - ((new Date(start).getUTCDay() + 6) % 7) * DAY;
  return { key: new Date(monday).toISOString().slice(0, 10), start: monday, end: monday + 7 * DAY };
}
const rewardId = (source: "activity-streak" | "weekly-challenge", account: string, key: string) => `${source}:${JSON.stringify([account, key])}`;

function proof(v: unknown, start: number, end: number): v is Proof {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return id(p["eventId"]) && time(p["occurredAt"]) && p["occurredAt"] >= start && p["occurredAt"] < end
    && typeof p["verified"] === "boolean" && typeof p["demo"] === "boolean";
}

function ledgerTotal(ledger: LocalXpLedger, account: string, now: number): number | null {
  if (!ledger || ledger.accountId !== account || !Array.isArray(ledger.awards)) return null;
  let total = 0;
  const ids = new Set<string>();
  for (const a of ledger.awards) {
    if (!isValidXpAward(a) || a.accountId !== account || a.occurredAt > now || ids.has(a.eventId) || a.amount > Number.MAX_SAFE_INTEGER - total) return null;
    ids.add(a.eventId); total += a.amount;
  }
  return total;
}

function prepare(ledger: LocalXpLedger, account: string, now: number, expected: XpAward | null, qualifyingDays: number): PeriodDecision {
  const total = ledgerTotal(ledger, account, now);
  if (total === null) return { status: "invalid-ledger" };
  const existing = expected && ledger.awards.find((a) => a.eventId === expected.eventId);
  if (existing && (existing.source !== expected.source || existing.amount !== expected.amount || existing.objectId !== expected.objectId || existing.occurredAt !== expected.occurredAt)) return { status: "reconciliation-required" };
  if (expected && !existing && expected.amount > Number.MAX_SAFE_INTEGER - total) return { status: "overflow" };
  return { status: "prepared", award: existing || !expected ? null : Object.freeze(expected), qualifyingDays };
}

/** A canonical day carries login plus one or more independently verified actions.
 * Qualifying battle proof includes valid entry/completion/non-simulated opponents;
 * listening includes real Discover audio qualification; engagement includes spam,
 * own-content and like/unlike replay validation. The flags alone are NOT security.
 * Only finalized, fully covered days are eligible. Late data for an unfinalized day
 * must be reconciled upstream, not treated as a missed day or silently backfilled.
 */
export function prepareStreakXp(history: StreakHistory, dayKey: string, ledger: LocalXpLedger, now: number): PeriodDecision {
  try {
    if (!history || !id(history.accountId) || !time(now) || typeof history.complete !== "boolean" || !Array.isArray(history.days)) return { status: "invalid-history" };
    if (!history.complete) return { status: "incomplete-history" };
    const created = dailyDayBounds(history.accountCreatedDay).start;
    const closed = dailyDayBounds(history.closedThroughDay);
    const target = dailyDayBounds(dayKey).start;
    if (created > target || target > closed.start || closed.end > now) return { status: "incomplete-history" };
    const canonical = new Map<string, StreakDay>();
    const eventIds = new Map<string, string>();
    const actionIds = new Map<string, string>();
    const active: { day: string; at: number; start: number }[] = [];
    for (const day of history.days) {
      if (!day || day.accountId !== history.accountId || !Array.isArray(day.activities)) return { status: "invalid-history" };
      const bounds = dailyDayBounds(day.dayKey);
      if (bounds.start < created || bounds.start > closed.start) return { status: "invalid-history" };
      const previous = canonical.get(day.dayKey);
      if (previous) {
        if (JSON.stringify(previous) !== JSON.stringify(day)) return { status: "reconciliation-required" };
        continue;
      }
      canonical.set(day.dayKey, day);
      const register = (p: Proof) => {
        const signature = JSON.stringify(p);
        const old = eventIds.get(p.eventId);
        if (old && old !== signature) throw new Error("Conflicting activity identity");
        eventIds.set(p.eventId, signature);
      };
      if (day.login !== null) {
        if (!proof(day.login, bounds.start, bounds.end)) return { status: "invalid-history" };
        register(day.login);
      }
      const validTimes: number[] = [];
      for (const raw of day.activities) {
        const a = raw as StreakActivity;
        if (!proof(raw, bounds.start, bounds.end) || !id(a.objectId) || !id(a.targetOwnerId) || typeof a.qualifying !== "boolean"
          || !["battle-completed", "discover-listened", "post-liked", "comment-published", "lobby-post-published"].includes(a.type)) return { status: "invalid-history" };
        register(a);
        if (!a.verified || a.demo || !a.qualifying || (a.type !== "lobby-post-published" && a.targetOwnerId === day.accountId)) continue;
        // A like/comment/post/battle has a durable action identity even when delivery
        // IDs change. Repeated listens may qualify on a new day, not repeated likes.
        const action = JSON.stringify([a.type, a.objectId, a.type === "discover-listened" ? day.dayKey : null]);
        const priorDay = actionIds.get(action);
        if (priorDay && priorDay !== day.dayKey) return { status: "reconciliation-required" };
        actionIds.set(action, day.dayKey);
        validTimes.push(a.occurredAt);
      }
      if (day.login?.verified && !day.login.demo && validTimes.length) active.push({ day: day.dayKey, start: bounds.start, at: Math.max(day.login.occurredAt, Math.min(...validTimes)) });
    }
    active.sort((a, b) => a.start - b.start);
    const expected = new Map<string, XpAward>();
    let run = 0, previousStart: number | null = null, targetRun = 0;
    for (const day of active) {
      run = previousStart !== null && day.start - previousStart === DAY ? run + 1 : 1;
      previousStart = day.start;
      expected.set(rewardId("activity-streak", history.accountId, day.day), { accountId: history.accountId,
        eventId: rewardId("activity-streak", history.accountId, day.day), source: "activity-streak", amount: Math.min(run, 5) * 5,
        occurredAt: day.at, objectId: day.day });
      if (day.start === target) targetRun = run;
    }
    if (ledgerTotal(ledger, history.accountId, now) === null) return { status: "invalid-ledger" };
    for (const a of ledger.awards.filter((a) => a.source === "activity-streak")) {
      const e = expected.get(a.eventId);
      if (!e || a.amount !== e.amount || a.objectId !== e.objectId || a.occurredAt !== e.occurredAt) return { status: "reconciliation-required" };
    }
    const award = expected.get(rewardId("activity-streak", history.accountId, dayKey)) ?? null;
    return prepare(ledger, history.accountId, now, award, targetRun);
  } catch { return { status: "invalid-history" }; }
}

/** Consumes Phase 3 summaries, not invented challenge-completion events. A backend
 * must attest one canonical finalized summary per account/day and complete coverage
 * through closedThroughDay. Identical replayed summaries count once; conflicting
 * snapshots require reconciliation. A fifth qualifying day can award before Sunday
 * once that day closes; later weeks never reset a separate activity streak.
 */
export function prepareWeeklyChallengeXp(history: WeeklyHistory, ledger: LocalXpLedger, now: number): PeriodDecision {
  try {
    if (!history || !id(history.accountId) || !time(now) || typeof history.complete !== "boolean" || !Array.isArray(history.records)) return { status: "invalid-history" };
    if (!history.complete) return { status: "incomplete-history" };
    const week = utcWeek(history.weekKey), closed = dailyDayBounds(history.closedThroughDay);
    if (week.key !== history.weekKey || closed.start < week.start || closed.start >= week.end || closed.end > now) return { status: "incomplete-history" };
    if (ledgerTotal(ledger, history.accountId, now) === null) return { status: "invalid-ledger" };
    const days = new Map<string, DailyCompletionRecord>();
    for (const r of history.records) {
      if (!r || r.accountId !== history.accountId || r.timezone !== "UTC" || r.catalogVersion !== 1 || typeof r.allThreeCompleted !== "boolean" || !Array.isArray(r.completedChallengeIds)) return { status: "invalid-history" };
      const bounds = dailyDayBounds(r.dayKey);
      if (bounds.start < week.start || bounds.start > closed.start) return { status: "invalid-history" };
      const definitions: ((typeof DAILY_CHALLENGES)[number] | undefined)[] = r.completedChallengeIds.map((challengeId: unknown) => DAILY_CHALLENGES.find((c) => c.id === challengeId));
      if (definitions.some((d) => !d) || new Set(definitions.map((d) => d!.difficulty)).size !== definitions.length
        || new Set(definitions.map((d) => d!.role)).size > 1) return { status: "invalid-history" };
      if (r.allThreeCompleted ? definitions.length !== 3 || !time(r.completedAt) || r.completedAt < bounds.start || r.completedAt >= bounds.end
        : definitions.length >= 3 || r.completedAt !== null) return { status: "invalid-history" };
      const prior = days.get(r.dayKey);
      if (prior && JSON.stringify(prior) !== JSON.stringify(r)) return { status: "reconciliation-required" };
      days.set(r.dayKey, r);
    }
    const qualifying = [...days.values()].filter((r) => r.allThreeCompleted).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    const eventId = rewardId("weekly-challenge", history.accountId, week.key);
    const award: XpAward | null = qualifying.length < 5 ? null : {
      accountId: history.accountId, eventId, source: "weekly-challenge", amount: 100,
      occurredAt: qualifying[4].completedAt!, objectId: week.key,
    };
    if (!award && ledger?.awards?.some((a) => a.eventId === eventId)) return { status: "reconciliation-required" };
    return prepare(ledger, history.accountId, now, award, qualifying.length);
  } catch { return { status: "invalid-history" }; }
}
