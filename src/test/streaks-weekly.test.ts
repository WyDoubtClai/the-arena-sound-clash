import { describe, expect, it } from "vitest";
import { applyDailyActivity, assignDailyChallenges, dailyDayBounds, prepareDailyChallengeXp, type CreatorRoles } from "@/lib/daily-challenges";
import { createLocalXpLedger, isValidXpAward, localXpProgress, processLocalXpAward, type LocalXpLedger, type XpAward } from "@/lib/progression";
import { prepareStreakXp, prepareWeeklyChallengeXp, utcWeek, type PeriodDecision, type StreakDay, type StreakHistory, type WeeklyHistory } from "@/lib/streaks-weekly";

const MONDAY = "2026-10-19", START = Date.parse(`${MONDAY}T00:00Z`), DAY = 86_400_000, NOW = START + 20 * DAY;
const key = (n: number) => new Date(START + n * DAY).toISOString().slice(0, 10);
const empty = () => createLocalXpLedger("account-a");
const day = (n: number): StreakDay => ({ accountId: "account-a", dayKey: key(n),
  login: { eventId: `login-${n}`, occurredAt: START + n * DAY + 1000, verified: true, demo: false },
  activities: [{ eventId: `activity-${n}`, occurredAt: START + n * DAY + 2000, verified: true, demo: false,
    type: "discover-listened", objectId: `track-${n}`, targetOwnerId: "other-creator", qualifying: true }],
});
const history = (ns = [0], closed = Math.max(...ns, 0)): StreakHistory => ({ accountId: "account-a", accountCreatedDay: MONDAY, closedThroughDay: key(closed), complete: true, days: ns.map(day) });
function award(result: PeriodDecision) {
  if (result.status !== "prepared" || !result.award) throw new Error(JSON.stringify(result));
  expect(isValidXpAward(result.award)).toBe(true);
  return result.award;
}

// Real Phase 3 output, with deterministic TEST facts rather than demo app activity.
function completion(n: number, role: CreatorRoles = "Artist") {
  let record = assignDailyChallenges("account-a", key(n), role);
  for (let i = 1; i <= 3; i++) {
    const beat = role === "Producer" || (role === "Both" && i === 2);
    record = applyDailyActivity(record, { eventId: `listen-${n}-${i}`, accountId: "account-a", occurredAt: START + n * DAY + i * 1000,
      verified: true, demo: false, type: "music-listened", trackId: `track-${i}`, creatorId: `other-${i}`, media: beat ? "beat" : "song", surface: beat ? "crate" : "discover", qualifiedListen: true }, NOW).record;
  }
  for (let i = 1; i <= 2; i++) record = applyDailyActivity(record, { eventId: `comment-${n}-${i}`, accountId: "account-a", occurredAt: START + n * DAY + 5000 + i * 1000,
    verified: true, demo: false, type: "meaningful-comment", commentId: `c-${i}`, postId: `p-${i}`, creatorId: `other-${i}`, creatorRole: role === "Producer" ? "Producer" : "Artist", contentFingerprint: `body-${i}`, meaningful: true, duplicateContent: false }, NOW).record;
  const result = prepareDailyChallengeXp(record, empty(), NOW);
  if (result.status !== "prepared" || !result.completion.allThreeCompleted) throw new Error("Test completion failed");
  return result.completion;
}
const weekly = (ns = [0, 1, 3, 5, 6]): WeeklyHistory => ({ accountId: "account-a", weekKey: MONDAY, closedThroughDay: key(6), complete: true, records: ns.map((n) => completion(n, n % 2 ? "Both" : "Producer")) });

describe("daily activity streak policy", () => {
  it.each([[0, 5], [1, 10], [2, 15], [3, 20], [4, 25], [5, 25], [6, 25], [7, 25]])("day index %i earns %i with a cap beyond day five", (n, xp) => {
    const result = prepareStreakXp(history(Array.from({ length: n + 1 }, (_, i) => i)), key(n), empty(), NOW);
    expect(award(result)).toMatchObject({ amount: xp, source: "activity-streak", objectId: key(n) });
    expect(result).toMatchObject({ qualifyingDays: n + 1 });
  });

  it("needs login AND an activity, not completed daily challenges", () => {
    const loginOnly = { ...day(0), activities: [] };
    const noLogin = { ...day(0), login: null };
    for (const d of [loginOnly, noLogin]) expect(prepareStreakXp({ ...history(), days: [d] }, key(0), empty(), NOW)).toMatchObject({ status: "prepared", award: null });
    expect(award(prepareStreakXp(history(), key(0), empty(), NOW)).amount).toBe(5);
  });

  it("counts duplicate days and deliveries once, with one shared account/day reward", () => {
    const d = day(0), duplicate = { ...d, activities: [...d.activities, ...d.activities] };
    const h = { ...history(), days: [duplicate, duplicate] };
    const a = award(prepareStreakXp(h, key(0), empty(), NOW));
    const ledger = processLocalXpAward(empty(), a).ledger;
    expect(prepareStreakXp(h, key(0), ledger, NOW)).toMatchObject({ status: "prepared", award: null, qualifyingDays: 1 });
    expect(processLocalXpAward(ledger, a).status).toBe("duplicate");
  });

  it("resets after a missed day, but not after a week boundary", () => {
    expect(award(prepareStreakXp(history([0, 1, 3]), key(3), empty(), NOW)).amount).toBe(5);
    expect(prepareStreakXp(history([0], 1), key(1), empty(), NOW)).toMatchObject({ award: null, qualifyingDays: 0 });
    expect(award(prepareStreakXp(history([4, 5, 6, 7]), key(7), empty(), NOW)).amount).toBe(20);
  });

  it.each(["battle-completed", "discover-listened", "post-liked", "comment-published", "lobby-post-published"] as const)("supports independently verified %s", (type) => {
    const d = day(0);
    expect(award(prepareStreakXp({ ...history(), days: [{ ...d, activities: [{ ...d.activities[0], type }] }] }, key(0), empty(), NOW)).amount).toBe(5);
  });

  it.each([{ verified: false }, { demo: true }, { qualifying: false }, { targetOwnerId: "account-a" }])("does not reward invalid/demo/self engagement %j", (change) => {
    const d = day(0);
    expect(prepareStreakXp({ ...history(), days: [{ ...d, activities: [{ ...d.activities[0], ...change }] }] }, key(0), empty(), NOW)).toMatchObject({ status: "prepared", award: null });
  });

  it("rejects repeated likes with new delivery IDs across days and conflicting event identities", () => {
    const first = day(0), second = day(1);
    const h = { ...history([0, 1]), days: [first, { ...second, activities: [{ ...second.activities[0], eventId: first.activities[0].eventId }] }] };
    expect(prepareStreakXp(h, key(1), empty(), NOW).status).toBe("invalid-history");
    const liked = (d: StreakDay) => ({ ...d, activities: [{ ...d.activities[0], type: "post-liked" as const, objectId: "same-post" }] });
    expect(prepareStreakXp({ ...history([0, 1]), days: [liked(first), liked(second)] }, key(1), empty(), NOW).status).toBe("reconciliation-required");
  });

  it("sorts closed history by event day and refuses unknown/missing coverage", () => {
    const h = history([0, 1, 2]);
    expect(prepareStreakXp({ ...h, days: [...h.days].reverse() }, key(2), empty(), NOW)).toEqual(prepareStreakXp(h, key(2), empty(), NOW));
    expect(prepareStreakXp({ ...h, complete: false }, key(2), empty(), NOW).status).toBe("incomplete-history");
    expect(prepareStreakXp(h, key(3), empty(), NOW).status).toBe("incomplete-history");
    expect(prepareStreakXp(h, key(2), empty(), START + 2 * DAY + 5000).status).toBe("incomplete-history");
  });

  it("requires reconciliation if late data changes an already credited streak", () => {
    const old = history([0, 2]);
    const ledger = processLocalXpAward(empty(), award(prepareStreakXp(old, key(2), empty(), NOW))).ledger;
    expect(prepareStreakXp(history([0, 1, 2]), key(2), ledger, NOW).status).toBe("reconciliation-required");
    expect(localXpProgress(ledger).lifetimeXp).toBe(5);
  });

  it("rejects incorrect UTC dates, wrong accounts and malformed/future activity", () => {
    const d = day(0), a = d.activities[0];
    for (const bad of [{ ...a, occurredAt: START - 1 }, { ...a, occurredAt: START + DAY }, { ...a, occurredAt: NaN }, { ...a, objectId: "" }]) {
      expect(prepareStreakXp({ ...history(), days: [{ ...d, activities: [bad] }] }, key(0), empty(), NOW).status).toBe("invalid-history");
    }
    expect(prepareStreakXp({ ...history(), days: [{ ...d, accountId: "other" }] }, key(0), empty(), NOW).status).toBe("invalid-history");
    expect(prepareStreakXp(history(), "2026-02-30", empty(), NOW).status).toBe("invalid-history");
    expect(prepareStreakXp(history(), key(0), createLocalXpLedger("other"), NOW).status).toBe("invalid-ledger");
  });
});

describe("five-of-seven weekly policy", () => {
  it("uses Monday–Sunday UTC, including year transitions", () => {
    expect(utcWeek("2026-10-25")).toEqual({ key: MONDAY, start: START, end: START + 7 * DAY });
    expect(utcWeek("2026-10-26").key).toBe("2026-10-26");
    expect(utcWeek("2027-01-01").key).toBe("2026-12-28");
  });

  it("rewards five nonconsecutive Phase 3 completions once despite different roles", () => {
    const h = weekly();
    const a = award(prepareWeeklyChallengeXp(h, empty(), NOW));
    expect(a).toMatchObject({ amount: 100, source: "weekly-challenge", objectId: MONDAY, occurredAt: START + 6 * DAY + 7000 });
    const ledger = processLocalXpAward(empty(), a).ledger;
    expect(prepareWeeklyChallengeXp(h, ledger, NOW)).toMatchObject({ status: "prepared", award: null, qualifyingDays: 5 });
    expect(processLocalXpAward(ledger, a).status).toBe("duplicate");
  });

  it("does not reward four days or repeated same-day completions", () => {
    expect(prepareWeeklyChallengeXp(weekly([0, 1, 3, 5]), empty(), NOW)).toMatchObject({ award: null, qualifyingDays: 4 });
    const one = completion(0);
    expect(prepareWeeklyChallengeXp({ ...weekly(), records: [one, one, one, one, one] }, empty(), NOW)).toMatchObject({ award: null, qualifyingDays: 1 });
  });

  it("can reward Friday once five finalized consecutive days exist; Sunday adds no extra reward", () => {
    const h = { ...weekly([0, 1, 2, 3, 4]), closedThroughDay: key(4) };
    const a = award(prepareWeeklyChallengeXp(h, empty(), START + 5 * DAY));
    const ledger = processLocalXpAward(empty(), a).ledger;
    expect(prepareWeeklyChallengeXp(weekly([0, 1, 2, 3, 4, 5, 6]), ledger, NOW)).toMatchObject({ status: "prepared", award: null });
  });

  it("ignores arrival order but requires finalized complete coverage for late summaries", () => {
    const h = weekly();
    expect(prepareWeeklyChallengeXp({ ...h, records: [...h.records].reverse() }, empty(), NOW)).toEqual(prepareWeeklyChallengeXp(h, empty(), NOW));
    expect(prepareWeeklyChallengeXp({ ...h, complete: false }, empty(), NOW).status).toBe("incomplete-history");
    expect(prepareWeeklyChallengeXp(h, empty(), START + 6 * DAY).status).toBe("incomplete-history");
  });

  it("rejects conflicting role/day snapshots rather than counting rerolled assignments", () => {
    const h = weekly();
    expect(prepareWeeklyChallengeXp({ ...h, records: [...h.records, completion(0, "Artist")] }, empty(), NOW).status).toBe("reconciliation-required");
  });

  it("validates Phase 3 summaries and excludes another UTC week/account", () => {
    const h = weekly(), r = h.records[0];
    for (const bad of [{ ...r, completedAt: START + DAY }, { ...r, completedChallengeIds: [r.completedChallengeIds[0], r.completedChallengeIds[0], r.completedChallengeIds[2]] },
      { ...r, allThreeCompleted: false }, { ...r, timezone: "local" }, { ...r, accountId: "other" }, { ...r, dayKey: "2026-10-26" }]) {
      expect(prepareWeeklyChallengeXp({ ...h, records: [bad] } as WeeklyHistory, empty(), NOW).status).toBe("invalid-history");
    }
    expect(prepareWeeklyChallengeXp({ ...h, weekKey: key(1) }, empty(), NOW).status).toBe("incomplete-history");
    expect(prepareWeeklyChallengeXp(h, createLocalXpLedger("other"), NOW).status).toBe("invalid-ledger");
  });

  it("keeps weekly and streak reward identities separate", () => {
    const a = award(prepareStreakXp(history(), key(0), empty(), NOW));
    const b = award(prepareWeeklyChallengeXp(weekly(), empty(), NOW));
    expect(a.eventId).not.toBe(b.eventId);
    const ledger = processLocalXpAward(processLocalXpAward(empty(), a).ledger, b).ledger;
    expect(localXpProgress(ledger).lifetimeXp).toBe(105);
  });

  it("fails closed on malformed ledger data and safe-integer overflow", () => {
    const base: XpAward = { accountId: "account-a", eventId: "prior", source: "battle-completed", amount: Number.MAX_SAFE_INTEGER - 100, occurredAt: START };
    const ledger = processLocalXpAward(empty(), base).ledger;
    const a = award(prepareWeeklyChallengeXp(weekly(), ledger, NOW));
    expect(localXpProgress(processLocalXpAward(ledger, a).ledger).lifetimeXp).toBe(Number.MAX_SAFE_INTEGER);
    const full = processLocalXpAward(empty(), { ...base, amount: Number.MAX_SAFE_INTEGER }).ledger;
    expect(prepareWeeklyChallengeXp(weekly(), full, NOW).status).toBe("overflow");
    expect(prepareStreakXp(history(), key(0), full, NOW).status).toBe("overflow");
    for (const amount of [-1, NaN, Infinity, 1.5]) {
      const bad: LocalXpLedger = { accountId: "account-a", awards: [{ ...base, amount }] };
      expect(prepareWeeklyChallengeXp(weekly(), bad, NOW).status).toBe("invalid-ledger");
    }
  });
});
