import { describe, expect, it } from "vitest";
import { createLocalXpLedger, localXpProgress, processLocalXpAward, type LocalXpLedger, type XpAward } from "@/lib/progression";
import { applyDailyActivity, assignDailyChallenges, dailyChallengeProgress, dailyDayBounds, DAILY_CHALLENGES, DAILY_XP,
  prepareDailyChallengeXp, type CreatorRoles, type DailyChallengeRecord, type VerifiedDailyActivity } from "@/lib/daily-challenges";

const DAY = "2026-10-24", START = Date.parse(`${DAY}T00:00:00Z`), END = START + 86_400_000;
type Music = Extract<VerifiedDailyActivity, { type: "music-listened" }>;
type Comment = Extract<VerifiedDailyActivity, { type: "meaningful-comment" }>;
type Battle = Extract<VerifiedDailyActivity, { type: "battle-completed" }>;
const assignment = (role: CreatorRoles = "Artist", accountId = "account-a", dayKey = DAY) => assignDailyChallenges(accountId, dayKey, role);
const music = (n = 1, change: Partial<Music> = {}): Music => ({
  type: "music-listened", eventId: `listen-${n}`, accountId: "account-a", occurredAt: START + n * 1000, verified: true, demo: false,
  trackId: `track-${n}`, creatorId: `creator-${n}`, media: "song", surface: "discover", qualifiedListen: true, ...change,
});
const comment = (n = 1, change: Partial<Comment> = {}): Comment => ({
  type: "meaningful-comment", eventId: `comment-${n}`, accountId: "account-a", occurredAt: START + n * 1000 + 5000, verified: true, demo: false,
  commentId: `comment-${n}`, postId: `post-${n}`, creatorId: `creator-${n}`, creatorRole: "Artist", contentFingerprint: `content-${n}`, meaningful: true, duplicateContent: false, ...change,
});
const battle = (change: Partial<Battle> = {}): Battle => ({
  type: "battle-completed", eventId: "battle-event", accountId: "account-a", occurredAt: START + 10000, verified: true, demo: false,
  battleId: "battle-1", battleRole: "Artist", validCompletion: true, eligibleBattle: true, simulatedParticipants: false, ...change,
});
function add(record: DailyChallengeRecord, event: VerifiedDailyActivity, now = END) {
  const result = applyDailyActivity(record, event, now);
  expect(result.status).toBe("accepted");
  return result.record;
}
function completed(role: CreatorRoles = "Artist", accountId = "account-a", dayKey = DAY) {
  let record = assignment(role, accountId, dayKey);
  const start = dailyDayBounds(dayKey).start;
  for (let i = 1; i <= 3; i++) record = add(record, music(i, {
    accountId, occurredAt: start + i * 1000, ...(role === "Producer" || (role === "Both" && i === 2) ? { media: "beat", surface: "crate" } : {}),
  }), start + 20000);
  for (let i = 1; i <= 2; i++) record = add(record, comment(i, { accountId, occurredAt: start + i * 1000 + 5000, creatorRole: role === "Producer" ? "Producer" : "Artist" }), start + 20000);
  return record;
}
function prepared(record = completed(), ledger = createLocalXpLedger(record.accountId), now = END) {
  const result = prepareDailyChallengeXp(record, ledger, now);
  if (result.status !== "prepared") throw new Error(result.status);
  return result;
}
function credit(ledger: LocalXpLedger, awards: readonly XpAward[]) {
  for (const award of awards) {
    const result = processLocalXpAward(ledger, award);
    expect(result.status).toBe("credited");
    ledger = result.ledger;
  }
  return ledger;
}

describe("versioned daily challenge assignment", () => {
  it.each(["Artist", "Producer", "Both"] as const)("assigns exactly three compatible challenges for %s", (role) => {
    const record = assignment(role);
    const definitions = record.challengeIds.map((id) => DAILY_CHALLENGES.find((c) => c.id === id)!);
    expect(definitions).toHaveLength(3);
    expect(definitions.map((d) => d.role)).toEqual([role, role, role]);
    expect(definitions.map((d) => d.difficulty)).toEqual(["easy", "medium", "hard"]);
    expect(definitions.map((d) => d.xp)).toEqual([15, 25, 40]);
    expect(definitions.every((d) => d.version === 1 && d.allowedEventTypes.length && d.completionRequirements)).toBe(true);
    expect(dailyChallengeProgress(record).every((p) => !p.complete)).toBe(true);
  });

  it("is deterministic and retains its original role/progress through role switches", () => {
    const original = assignment();
    expect(assignment()).toEqual(original);
    const partial = add(original, music());
    for (const role of ["Artist", "Producer", "Both"] as const) expect(assignDailyChallenges("account-a", DAY, role, partial)).toBe(partial);
    expect(original.activities).toHaveLength(0);
    expect(Object.isFrozen(partial.activities)).toBe(true);
  });

  it("creates a separate next-day record with a rotating curated pool", () => {
    const next = assignment("Artist", "account-a", "2026-10-25");
    expect(next.dayKey).not.toBe(DAY);
    expect(next.activities).toHaveLength(0);
    expect(new Set(Array.from({ length: 10 }, (_, i) => assignment("Artist", "account-a", `2026-10-${String(20 + i).padStart(2, "0")}`).challengeIds.join())).size).toBeGreaterThan(1);
    expect(() => assignDailyChallenges("account-a", "2026-10-25", "Artist", assignment())).toThrow(RangeError);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-10-24T00:00Z", "10/24/2026", "2026-1-1", "", "1969-12-31"])("rejects malformed/unsupported date %s", (day) => {
    expect(() => dailyDayBounds(day)).toThrow(RangeError);
  });

  it("uses UTC boundaries even on DST transition dates", () => {
    expect(dailyDayBounds("2026-11-01")).toEqual({ start: Date.parse("2026-11-01T00:00Z"), end: Date.parse("2026-11-02T00:00Z"), timezone: "UTC" });
    expect(() => assignDailyChallenges("", DAY, "Artist")).toThrow(RangeError);
    expect(() => assignDailyChallenges("account-b", DAY, "Both", assignment())).toThrow(RangeError);
    expect(() => assignDailyChallenges("account-a", DAY, "Listener" as CreatorRoles)).toThrow(RangeError);
  });
});

describe("verified activity progress", () => {
  it("accumulates distinct creators rather than repeated tracks or self-listening", () => {
    let record = add(assignment(), music());
    record = add(record, music(2, { creatorId: "creator-1" }));
    expect(dailyChallengeProgress(record)[0].musicCreators).toBe(1);
    expect(applyDailyActivity(record, music(3, { creatorId: "account-a" }), END).status).toBe("ineligible");
    expect(applyDailyActivity(record, music(4, { trackId: "track-1" }), END).status).toBe("duplicate");
    record = add(record, music(3));
    expect(dailyChallengeProgress(record)[0].musicCreators).toBe(2);
    expect(dailyChallengeProgress(record)[2]).toMatchObject({ musicCreators: 2, commentCreators: 0, battles: 0, complete: false });
  });

  it("requires both media for mixed-role exploration", () => {
    let record = assignment("Both");
    for (let i = 1; i <= 3; i++) record = add(record, music(i));
    expect(dailyChallengeProgress(record)[0].complete).toBe(false);
    record = add(record, music(4, { media: "beat", surface: "crate" }));
    expect(dailyChallengeProgress(record)[0].complete).toBe(true);
  });

  it("requires different comment creators and rejects duplicate content with new delivery IDs", () => {
    let record = add(assignment(), comment());
    record = add(record, comment(2, { creatorId: "creator-1" }));
    expect(dailyChallengeProgress(record)[1].commentCreators).toBe(1);
    expect(applyDailyActivity(record, comment(3, { contentFingerprint: "content-1" }), END).status).toBe("duplicate");
    expect(applyDailyActivity(record, comment(3, { commentId: "comment-1" }), END).status).toBe("duplicate");
    expect(applyDailyActivity(record, comment(3, { creatorId: "account-a" }), END).status).toBe("ineligible");
  });

  it("rejects replayed event and battle identities even under changed delivery IDs", () => {
    const record = add(assignment(), battle());
    expect(applyDailyActivity(record, battle(), END)).toEqual({ record, status: "duplicate" });
    expect(applyDailyActivity(record, battle({ eventId: "another-delivery" }), END).status).toBe("duplicate");
  });

  it.each([
    music(1, { verified: false }), music(1, { demo: true }), music(1, { qualifiedListen: false }),
    music(1, { media: "beat", surface: "crate" }), music(1, { surface: "crate" }),
    comment(1, { creatorRole: "Producer" }), comment(1, { meaningful: false }), comment(1, { duplicateContent: true }),
    battle({ battleRole: "Producer" }), battle({ simulatedParticipants: true }), battle({ eligibleBattle: false }), battle({ validCompletion: false }),
  ])("rejects wrong-role or unqualified activity %j", (event) => {
    expect(applyDailyActivity(assignment(), event, END).status).toBe("ineligible");
  });

  it.each([null, [], {}, { ...music(), eventId: "" }, { ...music(), occurredAt: NaN }, { ...music(), occurredAt: -1 },
    { ...music(), occurredAt: 1.5 }, { ...music(), occurredAt: Infinity }, { ...music(), verified: "true" },
    { ...music(), type: "like-toggled" }, { ...comment(), contentFingerprint: "" }, { ...battle(), battleId: "" },
  ])("rejects malformed activity %j", (event) => {
    expect(applyDailyActivity(assignment(), event, END).status).toBe("invalid");
  });

  it("isolates accounts and rejects future activity and invalid processing clocks", () => {
    expect(applyDailyActivity(assignment(), music(1, { accountId: "account-b" }), END).status).toBe("wrong-account");
    expect(applyDailyActivity(assignment(), music(1, { occurredAt: START + 1001 }), START + 1000).status).toBe("invalid");
    expect(applyDailyActivity(assignment(), music(), NaN).status).toBe("invalid");
  });

  it("uses inclusive start, exclusive end, and never credits an event to the arrival day", () => {
    expect(applyDailyActivity(assignment(), music(1, { occurredAt: START - 1 }), END).status).toBe("wrong-day");
    expect(applyDailyActivity(assignment(), music(1, { occurredAt: START }), END).status).toBe("accepted");
    expect(applyDailyActivity(assignment(), music(1, { occurredAt: END - 1 }), END).status).toBe("accepted");
    expect(applyDailyActivity(assignment(), music(1, { occurredAt: END }), END).status).toBe("wrong-day");
    const next = assignment("Artist", "account-a", "2026-10-25");
    expect(applyDailyActivity(next, battle(), END + 1000).status).toBe("wrong-day");
    expect(applyDailyActivity(assignment(), battle(), END + 1000).status).toBe("accepted");
  });

  it("computes identical progress and event-time completion with late/out-of-order arrivals", () => {
    const events = [music(1), music(2), music(3), comment(1), comment(2)];
    const ordered = events.reduce((r, e) => add(r, e), assignment());
    const reversed = [...events].reverse().reduce((r, e) => add(r, e, END + 1000), assignment());
    expect(dailyChallengeProgress(reversed)).toEqual(dailyChallengeProgress(ordered));
    expect(prepared(reversed).awards).toEqual(prepared(ordered).awards);
  });

  it("rejects corrupted assignment/progress snapshots rather than trusting stored XP or roles", () => {
    const malformed = { ...assignment(), challengeIds: ["made-up-challenge"] };
    expect(applyDailyActivity(malformed, music(), END).status).toBe("invalid");
    expect(() => dailyChallengeProgress(malformed)).toThrow(RangeError);
    expect(prepareDailyChallengeXp(malformed, createLocalXpLedger("account-a"), END).status).toBe("invalid-record");
    expect(prepareDailyChallengeXp(completed(), createLocalXpLedger("account-a"), START).status).toBe("invalid-record");
    expect(applyDailyActivity({ ...assignment(), activities: [music(), music()] }, music(2), END).status).toBe("invalid");
  });
});

describe("hard alternatives and Phase 1 XP preparation", () => {
  it.each(["Artist", "Producer", "Both"] as const)("completes the hard battle path for %s exactly once", (role) => {
    const record = add(assignment(role), battle({ battleRole: role === "Producer" ? "Producer" : "Artist" }));
    expect(dailyChallengeProgress(record)[2]).toMatchObject({ complete: true, battles: 1, musicCreators: 0, commentCreators: 0 });
    expect(prepared(record).awards.map((a) => a.amount)).toEqual([40]);
  });

  it.each(["Artist", "Producer", "Both"] as const)("completes community alternatives for %s without a battle or audience", (role) => {
    expect(dailyChallengeProgress(completed(role))[2]).toMatchObject({ complete: true, battles: 0, musicCreators: 3, commentCreators: 2 });
  });

  it("prepares 15/25/40 plus a single 20 bonus, using only the shared ledger", () => {
    const ledger = createLocalXpLedger("account-a");
    const result = prepared(completed(), ledger);
    expect(result.awards.map((a) => a.amount)).toEqual([15, 25, 40, 20]);
    expect(result.awards.every((a) => a.source === "daily-challenge")).toBe(true);
    expect(localXpProgress(ledger).lifetimeXp).toBe(0); // pure preparation
    const updated = credit(ledger, result.awards);
    expect(localXpProgress(updated).lifetimeXp).toBe(100);
    expect(prepared(completed(), updated).awards).toEqual([]);
    for (const award of result.awards) expect(processLocalXpAward(updated, award).status).toBe("duplicate");
    expect(DAILY_XP).toEqual({ easy: 15, medium: 25, hard: 40, bonus: 20 });
  });

  it("tracks both partial paths independently and never grants 80 for completing both", () => {
    let record = add(add(assignment(), music()), comment());
    expect(dailyChallengeProgress(record)[2]).toMatchObject({ musicCreators: 1, commentCreators: 1, battles: 0, complete: false });
    record = add(record, battle());
    let ledger = credit(createLocalXpLedger("account-a"), prepared(record).awards);
    record = add(add(add(record, music(2)), music(3)), comment(2));
    ledger = credit(ledger, prepared(record, ledger).awards);
    expect(localXpProgress(ledger).lifetimeXp).toBe(100);
    expect(ledger.awards.filter((a) => a.amount === 40)).toHaveLength(1);
    expect(prepared(add(record, battle({ eventId: "battle-2", battleId: "battle-2" })), ledger).awards).toEqual([]);
  });

  it("keeps concurrent preparations idempotent with the same account/day reward IDs", () => {
    const record = completed();
    const a = prepared(record), b = prepared(record);
    expect(a.awards).toEqual(b.awards);
    const ledger = credit(createLocalXpLedger("account-a"), a.awards);
    for (const award of b.awards) expect(processLocalXpAward(ledger, award).status).toBe("duplicate");
    // Real concurrency needs backend transactions; stale independent local copies are not secure.
  });

  it("does not reaward a hard challenge when an earlier alternative arrives after credit", () => {
    const battleRecord = add(assignment(), battle());
    const ledger = credit(createLocalXpLedger("account-a"), prepared(battleRecord).awards);
    let record = battleRecord;
    for (const event of [music(1), music(2), music(3), comment(1), comment(2)]) record = add(record, event, END + 1000);
    const late = prepared(record, ledger, END + 1000);
    expect(late.awards.map((a) => a.amount)).toEqual([15, 25, 20]);
    expect(localXpProgress(credit(ledger, late.awards)).lifetimeXp).toBe(100);
  });

  it("does not duplicate bonus or rewards after role switches or a lost/recreated assignment", () => {
    const record = completed();
    const ledger = credit(createLocalXpLedger("account-a"), prepared(record).awards);
    expect(prepared(assignDailyChallenges("account-a", DAY, "Both", record), ledger).awards).toEqual([]);
    // Changing definitions without the original snapshot cannot invent fresh slot IDs.
    expect(prepareDailyChallengeXp(completed("Producer"), ledger, END).status).toBe("invalid-ledger");
    const producerIds = prepared(completed("Producer")).awards.map((a) => a.eventId);
    expect(producerIds).toEqual(ledger.awards.map((a) => a.eventId));
  });

  it("produces independent next-day rewards and a plain completion record for future weekly evaluation", () => {
    const first = prepared();
    let ledger = credit(createLocalXpLedger("account-a"), first.awards);
    const next = completed("Artist", "account-a", "2026-10-25");
    const second = prepared(next, ledger, END + 20000);
    ledger = credit(ledger, second.awards);
    expect(localXpProgress(ledger)).toMatchObject({ lifetimeXp: 200, level: 2 });
    expect(new Set([first.completion.dayKey, second.completion.dayKey]).size).toBe(2);
    expect(first.completion).toMatchObject({ accountId: "account-a", timezone: "UTC", catalogVersion: 1, allThreeCompleted: true, completedAt: START + 7000 });
    expect(first.completion.completedChallengeIds).toHaveLength(3);
    expect(first.awards.some((a) => a.source === "weekly-challenge" || a.source === "activity-streak")).toBe(false);
  });

  it("isolates progress/rewards between accounts", () => {
    const a = prepared(), b = prepared(completed("Both", "account-b"));
    expect(a.awards.map((e) => e.eventId)).not.toEqual(b.awards.map((e) => e.eventId));
    expect(prepareDailyChallengeXp(completed(), createLocalXpLedger("account-b"), END).status).toBe("wrong-account");
    expect(localXpProgress(credit(createLocalXpLedger("account-b"), b.awards)).lifetimeXp).toBe(100);
  });

  it("does not issue a completion bonus for a partially completed day", () => {
    const partial = prepared(add(assignment(), battle()));
    expect(partial.awards.map((a) => a.amount)).toEqual([40]);
    expect(partial.completion).toMatchObject({ allThreeCompleted: false, completedAt: null });
  });

  it("rejects malformed, inflated, foreign, duplicate and future reward history", () => {
    const record = completed();
    const award = prepared(record).awards[0];
    const cases: unknown[][] = [[null], [{ ...award, amount: -1 }], [{ ...award, amount: 100 }],
      [{ ...award, accountId: "account-b" }], [award, award], [{ ...award, occurredAt: END + 1 }],
      [{ ...award, eventId: "daily:garbage" }], [{ ...award, objectId: "other-definition" }],
      [{ ...award, occurredAt: START - 1 }], [{ ...award, source: "unknown" }],
    ];
    for (const awards of cases) expect(prepareDailyChallengeXp(record, { accountId: "account-a", awards } as LocalXpLedger, END).status).toBe("invalid-ledger");
    expect(prepareDailyChallengeXp(record, { accountId: "account-a", awards: null } as unknown as LocalXpLedger, END).status).toBe("invalid-ledger");
  });

  it("checks safe totals and rejects an overflowing batch without partial credit", () => {
    const other: XpAward = { accountId: "account-a", eventId: "prior", source: "battle-completed", amount: Number.MAX_SAFE_INTEGER - 100, occurredAt: START };
    const ledger = processLocalXpAward(createLocalXpLedger("account-a"), other).ledger;
    const result = prepared(completed(), ledger);
    expect(localXpProgress(credit(ledger, result.awards)).lifetimeXp).toBe(Number.MAX_SAFE_INTEGER);
    const almostFull = processLocalXpAward(createLocalXpLedger("account-a"), { ...other, amount: Number.MAX_SAFE_INTEGER - 99 }).ledger;
    expect(prepareDailyChallengeXp(completed(), almostFull, END).status).toBe("overflow");
    expect(almostFull.awards).toHaveLength(1);
    expect(prepareDailyChallengeXp(completed(), { accountId: "account-a", awards: [{ ...other, amount: Number.MAX_SAFE_INTEGER }, { ...other, eventId: "overflow", amount: 1 }] }, END).status).toBe("invalid-ledger");
  });
});
