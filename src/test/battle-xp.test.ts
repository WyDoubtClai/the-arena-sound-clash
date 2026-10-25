import { describe, expect, it } from "vitest";
import { prepareBattleXp, type BattleXpDecision, type BattleXpParticipant, type FinalBattleXpResult } from "@/lib/battle-xp";
import { createLocalXpLedger, isValidXpAward, localXpProgress, processLocalXpAward, type LocalXpLedger, type XpAward } from "@/lib/progression";

const NOW = 1_800_000_000_000;
const fixture = (mode: "ranked" | "unranked" = "ranked"): FinalBattleXpResult => ({
  division: "Artist", format: "song", matchId: "match-1", resultId: "result-1", mode,
  completed: true, finalized: true, valid: true, verified: true, demo: false, completedAt: NOW - 1000, finalizedAt: NOW,
  participants: Array.from({ length: 8 }, (_, i) => ({
    participantId: `participant-${i}`, accountId: `account-${i}`, authenticated: true, simulated: false, participationVerified: true,
    entryId: `entry-${i}`, submissionValid: true, submissionEligible: true, placement: i + 1, requiredJudgingComplete: true, judgingVerified: true,
  })),
});
const empty = () => createLocalXpLedger("account-0");
const decide = (result: unknown = fixture(), ledger = empty(), now = NOW) => prepareBattleXp(result, "account-0", "participant-0", ledger, now);
const changed = (fields: Partial<BattleXpParticipant>) => ({ ...fixture(), participants: fixture().participants.map((p, i) => i ? p : { ...p, ...fields }) });
function prepared(result: BattleXpDecision) {
  if (result.status !== "prepared") throw new Error(result.status);
  return result;
}
function credit(ledger: LocalXpLedger, awards: readonly XpAward[]) {
  for (const a of awards) { expect(isValidXpAward(a)).toBe(true); const r = processLocalXpAward(ledger, a); expect(r.status).toBe("credited"); ledger = r.ledger; }
  return ledger;
}
const placements = ["ranked", "unranked"].flatMap((mode) => (mode === "ranked" ? [300, 225, 175, 125, 75, 75, 75, 75] : [150, 110, 90, 60, 40, 40, 40, 40])
  .map((xp, i) => [mode as "ranked" | "unranked", i + 1, xp] as const));

describe("dormant battle XP policy", () => {
  it.each(placements)("%s placement %i prepares %i placement XP", (mode, placement, xp) => {
    const result = fixture(mode), index = placement - 1;
    const r = prepared(prepareBattleXp(result, `account-${index}`, `participant-${index}`, createLocalXpLedger(`account-${index}`), NOW));
    expect(r.placementXp).toBe(xp);
    expect(r.judgingXp).toBe(mode === "ranked" ? 25 : 15);
    expect(r.awards.map((a) => a.amount)).toEqual([xp, r.judgingXp]);
    expect(r.awards.every((a) => a.source === "battle-completed")).toBe(true);
  });

  it.each(["ranked", "unranked"] as const)("%s requires verified completed judging for its bonus", (mode) => {
    for (const flags of [{ requiredJudgingComplete: false }, { judgingVerified: false }, { requiredJudgingComplete: false, judgingVerified: false }]) {
      const r = prepared(decide({ ...changed(flags), mode }));
      expect(r.judgingXp).toBe(0);
      expect(r.awards).toHaveLength(1);
      expect(r.placementXp).toBe(mode === "ranked" ? 300 : 150);
    }
  });

  it.each(["missing", "invalid", "ineligible"])("awards zero, including judging, for a %s entry", (kind) => {
    const result = { ...fixture(), participants: fixture().participants.map((p, i) => i
      ? { ...p, placement: i }
      : { ...p, entryId: kind === "missing" ? null : p.entryId, placement: null, submissionValid: kind !== "invalid" && kind !== "missing", submissionEligible: kind !== "ineligible" }) };
    expect(prepared(decide(result))).toMatchObject({ awards: [], placementXp: 0, judgingXp: 0 });
  });

  it.each([{ division: "Artist", format: "creation" }, { division: "Artist", format: "song" }, { division: "Producer", format: "sample-flip" }])("supports existing format %j without connecting battle engines", (format) => {
    expect(prepared(decide({ ...fixture(), ...format })).awards).toHaveLength(2);
  });

  it.each([{ completed: false }, { finalized: false }, { valid: false }, { verified: false }, { demo: true }])("rejects untrusted/nonfinal/demo results %j", (change) => {
    expect(decide({ ...fixture(), ...change }).status).toBe("ineligible");
  });

  it.each([{ authenticated: false }, { participationVerified: false }, { simulated: true }])("rejects illegitimate eight-player participation %j", (change) => {
    expect(decide(changed(change)).status).toBe("ineligible");
    const r = fixture();
    expect(decide({ ...r, participants: r.participants.map((p, i) => i === 7 ? { ...p, ...change } : p) }).status).toBe("ineligible");
  });

  it("credits once through Phase 1 and supports retry after partial batch persistence", () => {
    const r = prepared(decide());
    const partial = credit(empty(), [r.awards[0]]);
    expect(prepared(decide(fixture(), partial)).awards.map((a) => a.amount)).toEqual([25]);
    const ledger = credit(partial, prepared(decide(fixture(), partial)).awards);
    expect(localXpProgress(ledger).lifetimeXp).toBe(325);
    expect(prepared(decide(fixture(), ledger)).awards).toEqual([]);
    for (const a of r.awards) expect(processLocalXpAward(ledger, a).status).toBe("duplicate");
    expect(localXpProgress(empty()).lifetimeXp).toBe(0);
  });

  it("canonicalizes roster order without changing reward binding", () => {
    expect(decide({ ...fixture(), participants: [...fixture().participants].reverse() })).toEqual(decide());
  });

  it.each(["result-id", "judging", "timestamp", "mode", "alias", "entry", "other-entry"])("rejects %s corrections after finalization rather than adding rewards", (kind) => {
    const ledger = credit(empty(), prepared(decide()).awards);
    let r = fixture();
    if (kind === "result-id") r = { ...r, resultId: "another-result-id" };
    if (kind === "judging") r = changed({ requiredJudgingComplete: false });
    if (kind === "timestamp") r = { ...r, finalizedAt: NOW - 1 };
    if (kind === "mode") r = { ...r, mode: "unranked" };
    if (kind === "alias") r = changed({ participantId: "new-alias" });
    if (kind === "entry") r = changed({ entryId: "new-entry" });
    if (kind === "other-entry") r = { ...r, participants: r.participants.map((p, i) => i === 7 ? { ...p, entryId: "other-new-entry" } : p) };
    expect(prepareBattleXp(r, "account-0", kind === "alias" ? "new-alias" : "participant-0", ledger, NOW).status).toBe("reconciliation-required");
  });

  it("rejects replaying one result under another match but allows a genuinely different match/result pair", () => {
    const ledger = credit(empty(), prepared(decide()).awards);
    expect(decide({ ...fixture(), matchId: "match-2" }, ledger).status).toBe("reconciliation-required");
    expect(prepared(decide({ ...fixture(), matchId: "match-2", resultId: "result-2" }, ledger)).awards).toHaveLength(2);
  });

  it("isolates account and participant identities", () => {
    expect(prepareBattleXp(fixture(), "account-1", "participant-0", createLocalXpLedger("account-1"), NOW).status).toBe("wrong-participant");
    expect(decide(fixture(), createLocalXpLedger("account-1")).status).toBe("invalid-ledger");
    const a = prepared(decide()).awards;
    const b = prepared(prepareBattleXp(fixture(), "account-1", "participant-1", createLocalXpLedger("account-1"), NOW)).awards;
    expect(a.map((e) => e.eventId)).not.toEqual(b.map((e) => e.eventId));
  });

  it.each([null, [], {}, { ...fixture(), matchId: "" }, { ...fixture(), resultId: " " }, { ...fixture(), mode: "custom" },
    { ...fixture(), format: "beat-for-beat" }, { ...fixture(), division: "Producer", format: "song" },
    { ...fixture(), participants: fixture().participants.slice(1) }, { ...fixture(), finalizedAt: NOW + 1 }, { ...fixture(), completedAt: NOW + 1 },
    { ...fixture(), finalizedAt: NaN }, { ...fixture(), finalizedAt: -1 }, changed({ placement: 0 }), changed({ placement: 1.5 }),
    changed({ accountId: "account-1" }), changed({ participantId: "participant-1" }), changed({ entryId: "entry-1" }), changed({ placement: 2 }),
    { ...fixture(), verified: "true" },
  ])("rejects malformed result or unsupported format %j", (value) => {
    expect(decide(value).status).toBe("invalid-result");
  });

  it("rejects malformed/replayed/future ledger data and invalid clocks", () => {
    const a = prepared(decide()).awards[0];
    for (const awards of [[{ ...a, amount: -1 }], [{ ...a, amount: NaN }], [a, a], [{ ...a, accountId: "other" }], [{ ...a, occurredAt: NOW + 1 }], [{ ...a, objectId: "battle-result:bad-json" }]]) {
      expect(decide(fixture(), { accountId: "account-0", awards }).status).toBe("invalid-ledger");
    }
    expect(decide(fixture(), empty(), Infinity).status).toBe("invalid-result");
    expect(decide(fixture(), empty(), NOW - 1).status).toBe("invalid-result");
  });

  it("checks both awards together for overflow and never decreases existing XP", () => {
    const base: XpAward = { accountId: "account-0", eventId: "prior", source: "track-published", amount: Number.MAX_SAFE_INTEGER - 325, occurredAt: NOW };
    const ledger = processLocalXpAward(empty(), base).ledger;
    expect(localXpProgress(credit(ledger, prepared(decide(fixture(), ledger)).awards)).lifetimeXp).toBe(Number.MAX_SAFE_INTEGER);
    const almostFull = processLocalXpAward(empty(), { ...base, amount: Number.MAX_SAFE_INTEGER - 324 }).ledger;
    expect(decide(fixture(), almostFull).status).toBe("overflow");
    expect(almostFull.awards).toHaveLength(1);
    expect(decide(fixture(), { accountId: "account-0", awards: [{ ...base, amount: Number.MAX_SAFE_INTEGER }, { ...base, eventId: "overflow", amount: 1 }] }).status).toBe("invalid-ledger");
  });
});
