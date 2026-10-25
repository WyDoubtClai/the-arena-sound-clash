import { describe, expect, it } from "vitest";
import {
  createLocalXpLedger, isValidXpAward, levelFromXp, localXpProgress,
  processLocalXpAward, xpForLevel, xpProgress, xpToNextLevel,
  type XpAward,
} from "@/lib/progression";

const thresholds = [[1, 0], [2, 200], [3, 450], [5, 1100], [10, 3600], [20, 12350], [30, 26100], [50, 68600]];
const event = (changes: Partial<XpAward> = {}): XpAward => ({
  accountId: "account-a", eventId: "track-published:track-1", source: "track-published",
  amount: 200, occurredAt: 1792886400000, objectId: "track-1", ...changes,
});

describe("account XP arithmetic", () => {
  it.each(thresholds)("level %i starts at %i XP", (level, xp) => {
    expect(xpForLevel(level)).toBe(xp);
    expect(levelFromXp(xp)).toBe(level);
  });

  it.each(thresholds.slice(1))("level %i has exact boundaries around %i XP", (level, xp) => {
    expect(levelFromXp(xp - 1)).toBe(level - 1);
    expect(levelFromXp(xp)).toBe(level);
    expect(levelFromXp(xp + 1)).toBe(level);
    expect(xpProgress(xp - 1).xpToNextLevel).toBe(1);
    expect(xpProgress(xp).earnedInLevel).toBe(0);
    expect(xpProgress(xp + 1).earnedInLevel).toBe(1);
  });

  it("starts at level 1 without fabricating fixture XP", () => {
    expect(localXpProgress(createLocalXpLedger("blaze"))).toEqual({
      lifetimeXp: 0, level: 1, levelStartXp: 0, earnedInLevel: 0,
      levelCost: 200, xpToNextLevel: 200, fraction: 0,
    });
  });

  it("reports progress, next-level cost and remaining XP distinctly", () => {
    expect(xpProgress(325)).toEqual({ lifetimeXp: 325, level: 2, levelStartXp: 200, earnedInLevel: 125, levelCost: 250, xpToNextLevel: 125, fraction: 0.5 });
    expect(xpToNextLevel(450)).toBe(300);
    for (let level = 1; level < 100; level++) {
      expect(xpForLevel(level + 1) - xpForLevel(level)).toBe(200 + (level - 1) * 50);
    }
  });

  it.each([-1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid lifetime XP %s without producing negative XP", (xp) => {
    expect(() => levelFromXp(xp)).toThrow(RangeError);
    expect(() => xpProgress(xp)).toThrow(RangeError);
    expect(() => xpToNextLevel(xp)).toThrow(RangeError);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])("rejects invalid or unrepresentable level %s", (level) => {
    expect(() => xpForLevel(level)).toThrow(RangeError);
  });

  it("handles the entire safe integer XP range without rounding boundaries", () => {
    const xp = Number.MAX_SAFE_INTEGER;
    const progress = xpProgress(xp);
    expect(xpForLevel(progress.level)).toBeLessThanOrEqual(xp);
    expect(progress.earnedInLevel).toBeGreaterThanOrEqual(0);
    expect(progress.earnedInLevel).toBeLessThan(progress.levelCost);
    expect(progress.xpToNextLevel).toBe(xpToNextLevel(xp));
    expect(progress.earnedInLevel + progress.xpToNextLevel).toBe(progress.levelCost);
    // Exact bigint comparison even when the next threshold exceeds safe number precision.
    const next = BigInt(progress.level + 1);
    expect(25n * (next - 1n) * (next + 6n) - BigInt(xp)).toBe(BigInt(progress.xpToNextLevel));
    const largeThreshold = xpForLevel(1_000_000);
    expect(levelFromXp(largeThreshold - 1)).toBe(999_999);
    expect(levelFromXp(largeThreshold)).toBe(1_000_000);
    expect(levelFromXp(largeThreshold + 1)).toBe(1_000_000);
  });
});

describe("isolated local award contract (not production authorization)", () => {
  const invalidAwards: unknown[] = [null, [], {}, "event", event({ amount: -1 }), event({ amount: 1.5 }), event({ amount: NaN }), event({ amount: Infinity }), event({ amount: Number.MAX_SAFE_INTEGER + 1 }), event({ accountId: "" }), event({ eventId: " " }), event({ eventId: " id" }), event({ objectId: "" }), event({ occurredAt: -1 }), event({ occurredAt: 0.5 }), event({ occurredAt: Infinity }), event({ occurredAt: 8.64e15 + 1 }), { ...event(), amount: "200" }, { ...event(), source: "arbitrary" }, { ...event(), occurredAt: "2026-10-25" }];

  it.each(invalidAwards.map((value, index) => [index, value] as const))("rejects invalid award #%i without modifying state", (_, value) => {
    const ledger = createLocalXpLedger("account-a");
    expect(isValidXpAward(value)).toBe(false);
    expect(processLocalXpAward(ledger, value)).toEqual({ ledger, status: "invalid" });
    expect(localXpProgress(ledger).lifetimeXp).toBe(0);
  });

  it("accepts zero XP, epoch timestamps, and omitted optional object identity", () => {
    const { objectId: _, ...award } = event({ amount: 0, occurredAt: 0 });
    const result = processLocalXpAward(createLocalXpLedger("account-a"), award);
    expect(result.status).toBe("credited");
    expect(localXpProgress(result.ledger).level).toBe(1);
    expect(processLocalXpAward(result.ledger, award).status).toBe("duplicate");
  });

  it("credits distinct events once and derives levels without mutating inputs", () => {
    const original = createLocalXpLedger("account-a");
    const first = processLocalXpAward(original, event()).ledger;
    const duplicate = processLocalXpAward(first, event({ amount: 999, source: "battle-completed" }));
    expect(duplicate).toEqual({ ledger: first, status: "duplicate" });
    expect(duplicate.ledger).toBe(first);
    const second = processLocalXpAward(first, event({ eventId: "beat-published:beat-1", source: "beat-published", amount: 250 })).ledger;
    expect(localXpProgress(second)).toMatchObject({ lifetimeXp: 450, level: 3 });
    expect(localXpProgress(first).lifetimeXp).toBe(200);
    expect(localXpProgress(original).lifetimeXp).toBe(0);
    expect(second.awards).toHaveLength(2);
    const serialized = JSON.parse(JSON.stringify(second));
    expect(processLocalXpAward(serialized, event()).status).toBe("duplicate");
  });

  it("scopes identity to accounts, not artist/producer roles or display labels", () => {
    const a = processLocalXpAward(createLocalXpLedger("account-a"), event()).ledger;
    const b = createLocalXpLedger("account-b");
    expect(processLocalXpAward(b, event())).toEqual({ ledger: b, status: "wrong-account" });
    const creditedB = processLocalXpAward(b, event({ accountId: "account-b" }));
    expect(creditedB.status).toBe("credited");
    expect(localXpProgress(creditedB.ledger).lifetimeXp).toBe(200);
    expect(localXpProgress(a).lifetimeXp).toBe(200);
    expect(() => createLocalXpLedger(" ")).toThrow(RangeError);
  });

  it("snapshots events so later caller changes cannot decrease earned XP", () => {
    const input = { ...event() };
    const result = processLocalXpAward(createLocalXpLedger("account-a"), input);
    input.amount = 0;
    input.eventId = "different-event";
    expect(localXpProgress(result.ledger).lifetimeXp).toBe(200);
    expect(result.ledger.awards[0].eventId).toBe(event().eventId);
    expect(Object.isFrozen(result.ledger.awards[0])).toBe(true);
    expect(Object.isFrozen(result.ledger.awards)).toBe(true);
  });

  it("rejects overflow without corrupting previously credited XP", () => {
    const ledger = processLocalXpAward(createLocalXpLedger("account-a"), event({ amount: Number.MAX_SAFE_INTEGER })).ledger;
    expect(processLocalXpAward(ledger, event({ eventId: "overflow", amount: 1 }))).toEqual({ ledger, status: "overflow" });
    expect(localXpProgress(ledger).lifetimeXp).toBe(Number.MAX_SAFE_INTEGER);
  });
});
