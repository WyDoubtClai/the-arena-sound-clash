import { describe, expect, it } from "vitest";
import { createLocalXpLedger, isValidXpAward, localXpProgress, processLocalXpAward, type LocalXpLedger, type XpAward } from "@/lib/progression";
import { preparePublishingXp, PUBLISHING_WINDOW_MS, type PublicationFacts } from "@/lib/publishing-xp";

const START = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const facts = (changes: Partial<PublicationFacts> = {}): PublicationFacts => ({
  publicationId: "publication-1", accountId: "account-a", originalTrackId: "original-1",
  kind: "song", operation: "first-publication", status: "published", demo: false,
  originalVerified: true, provenanceVerified: true, publicationVerified: true,
  firstPublishedAt: START, ...changes,
});

// Simulate a future trusted caller with fixed facts. Only Phase 1 actually reduces XP.
function credit(ledger: LocalXpLedger, publication = facts(), now = publication.firstPublishedAt) {
  const result = preparePublishingXp(publication, ledger.accountId, ledger, now);
  if (!result.eligible) throw new Error(result.reason);
  expect(isValidXpAward(result.award)).toBe(true);
  const reduced = processLocalXpAward(ledger, result.award);
  expect(reduced.status).toBe("credited");
  return reduced.ledger;
}

function five(accountId = "account-a") {
  let ledger = createLocalXpLedger(accountId);
  for (let i = 0; i < 5; i++) ledger = credit(ledger, facts({
    accountId, publicationId: `pub-${i}`, originalTrackId: `original-${i}`,
    kind: i % 2 ? "beat" : "song", firstPublishedAt: START + i * DAY,
  }));
  return ledger;
}

describe("publishing XP policy preparation (no live issuance)", () => {
  it.each(["song", "beat"] as const)("prepares exactly 50 XP for a verified original %s", (kind) => {
    const ledger = createLocalXpLedger("account-a");
    const result = preparePublishingXp(facts({ kind }), "account-a", ledger, START);
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.award).toMatchObject({ accountId: "account-a", amount: 50, source: kind === "song" ? "track-published" : "beat-published", occurredAt: START, objectId: "original-1" });
    expect(ledger.awards).toHaveLength(0); // preparation cannot award XP
    expect(localXpProgress(credit(ledger, facts({ kind })))).toMatchObject({ lifetimeXp: 50, level: 1 });
  });

  it("shares five rewards / 250 XP across song and beat publications", () => {
    const ledger = five();
    expect(localXpProgress(ledger).lifetimeXp).toBe(250);
    expect(ledger.awards.map((a) => a.source)).toContain("track-published");
    expect(ledger.awards.map((a) => a.source)).toContain("beat-published");
    const sixth = facts({ originalTrackId: "sixth", firstPublishedAt: START + 5 * DAY });
    expect(preparePublishingXp(sixth, "account-a", ledger, sixth.firstPublishedAt)).toEqual({ eligible: false, reason: "allowance-exhausted" });
    expect(localXpProgress(ledger).lifetimeXp).toBe(250);
  });

  it("rewards a new publication after an older award expires, with no calendar reset", () => {
    const ledger = five();
    const next = facts({ originalTrackId: "new", firstPublishedAt: START + 7 * DAY });
    expect(localXpProgress(credit(ledger, next)).lifetimeXp).toBe(300);
    // A calendar-week rollover is irrelevant while all five remain within 7 days.
    expect(preparePublishingXp({ ...next, firstPublishedAt: START + 6 * DAY }, "account-a", ledger, START + 6 * DAY)).toEqual({ eligible: false, reason: "allowance-exhausted" });
  });

  it.each([-1, 0, 1])("uses an exact rolling boundary at 7 days %+i ms", (offset) => {
    let ledger = createLocalXpLedger("account-a");
    for (let i = 0; i < 5; i++) ledger = credit(ledger, facts({ originalTrackId: `simultaneous-${i}` }));
    const publication = facts({ originalTrackId: "next", firstPublishedAt: START + PUBLISHING_WINDOW_MS + offset });
    const result = preparePublishingXp(publication, "account-a", ledger, publication.firstPublishedAt);
    expect(result.eligible).toBe(offset >= 0);
  });

  it("never retroactively credits the sixth publication when retry time advances", () => {
    const ledger = five();
    const sixth = facts({ originalTrackId: "sixth", firstPublishedAt: START + 5 * DAY });
    for (const now of [START + 5 * DAY, START + 8 * DAY, START + 30 * DAY]) {
      expect(preparePublishingXp(sixth, "account-a", ledger, now)).toEqual({ eligible: false, reason: "allowance-exhausted" });
    }
    // Even after another genuinely new publication is rewarded, old events are not backfilled.
    const updated = credit(ledger, facts({ originalTrackId: "new", firstPublishedAt: START + 8 * DAY }));
    expect(preparePublishingXp(sixth, "account-a", updated, START + 30 * DAY)).toEqual({ eligible: false, reason: "out-of-order" });
  });

  it("deduplicates by account + original identity regardless of publication/listing IDs or media kind", () => {
    const empty = createLocalXpLedger("account-a");
    const prepared = preparePublishingXp(facts(), "account-a", empty, START);
    if (!prepared.eligible) throw new Error(prepared.reason);
    const ledger = processLocalXpAward(empty, prepared.award).ledger;
    expect(processLocalXpAward(ledger, prepared.award)).toEqual({ ledger, status: "duplicate" });
    expect(preparePublishingXp(facts(), "account-a", ledger, START)).toEqual({ eligible: false, reason: "duplicate" });
    const renamedListing = facts({ kind: "beat", publicationId: "different-crate-or-reupload-record", firstPublishedAt: START + DAY });
    expect(preparePublishingXp(renamedListing, "account-a", ledger, START + DAY)).toEqual({ eligible: false, reason: "duplicate" });
    expect(localXpProgress(ledger).lifetimeXp).toBe(50);
  });

  it.each(["edit", "crate-listing", "reupload"] as const)("does not reward a %s operation", (operation) => {
    const ledger = credit(createLocalXpLedger("account-a"));
    expect(preparePublishingXp(facts({ operation }), "account-a", ledger, START)).toEqual({ eligible: false, reason: "ineligible" });
    expect(preparePublishingXp(facts({ operation }), "account-a", createLocalXpLedger("account-a"), START)).toEqual({ eligible: false, reason: "ineligible" });
    expect(localXpProgress(ledger).lifetimeXp).toBe(50);
  });

  it.each([
    { status: "draft" }, { originalVerified: false }, { provenanceVerified: false },
    { publicationVerified: false }, { demo: true },
  ] as Partial<PublicationFacts>[])("rejects ineligible publication %j", (change) => {
    expect(preparePublishingXp(facts(change), "account-a", createLocalXpLedger("account-a"), START)).toEqual({ eligible: false, reason: "ineligible" });
  });

  it("keeps separate account allowances and rejects owner/principal mismatches", () => {
    const a = five();
    const b = createLocalXpLedger("account-b");
    const publication = facts({ accountId: "account-b", firstPublishedAt: START + 5 * DAY });
    expect(localXpProgress(credit(b, publication)).lifetimeXp).toBe(50);
    expect(localXpProgress(a).lifetimeXp).toBe(250);
    expect(preparePublishingXp(publication, "account-a", a, publication.firstPublishedAt)).toEqual({ eligible: false, reason: "wrong-account" });
    expect(preparePublishingXp(publication, "account-b", a, publication.firstPublishedAt)).toEqual({ eligible: false, reason: "wrong-account" });
    expect(preparePublishingXp(publication, "", b, publication.firstPublishedAt)).toEqual({ eligible: false, reason: "wrong-account" });
  });

  it.each(["Artist", "Producer", "Both"])("ignores selected role %s when enforcing the shared allowance", (role) => {
    const publication = { ...facts({ originalTrackId: "sixth", firstPublishedAt: START + 5 * DAY }), role };
    expect(preparePublishingXp(publication, "account-a", five(), publication.firstPublishedAt)).toEqual({ eligible: false, reason: "allowance-exhausted" });
  });

  it("rejects out-of-order new publications rather than silently miscalculating the allowance", () => {
    const ledger = credit(createLocalXpLedger("account-a"), facts({ firstPublishedAt: START + DAY }));
    expect(preparePublishingXp(facts({ originalTrackId: "late" }), "account-a", ledger, START + 2 * DAY)).toEqual({ eligible: false, reason: "out-of-order" });
  });

  it.each([null, [], {}, "publication", facts({ publicationId: "" }), facts({ originalTrackId: " " }),
    facts({ firstPublishedAt: -1 }), facts({ firstPublishedAt: NaN }), facts({ firstPublishedAt: Infinity }),
    facts({ firstPublishedAt: 0.5 }), facts({ firstPublishedAt: START + 1 }), facts({ firstPublishedAt: 8.64e15 + 1 }),
    { ...facts(), kind: "sample" }, { ...facts(), demo: "false" }, { ...facts(), operation: "unknown" },
  ])("rejects malformed/future publication %j", (publication) => {
    expect(preparePublishingXp(publication, "account-a", createLocalXpLedger("account-a"), START)).toEqual({ eligible: false, reason: "invalid-publication" });
  });

  it.each([-1, NaN, Infinity, 0.1, 8.64e15 + 1])("rejects invalid trusted now %s", (now) => {
    expect(preparePublishingXp(facts(), "account-a", createLocalXpLedger("account-a"), now)).toEqual({ eligible: false, reason: "invalid-publication" });
  });

  it("rejects malformed, foreign, future, duplicate and overflowing ledger data", () => {
    const ledger = credit(createLocalXpLedger("account-a"));
    const award = ledger.awards[0];
    const malformed: unknown[][] = [
      [null], [{ ...award, amount: -50 }], [{ ...award, amount: 1.5 }], [{ ...award, amount: "50" }],
      [{ ...award, amount: 51 }], [{ ...award, occurredAt: START + 1 }], [{ ...award, occurredAt: NaN }],
      [{ ...award, accountId: "account-b" }], [{ ...award, objectId: "" }], [{ ...award, eventId: "filename.wav" }],
      [award, award], [{ ...award, source: "unknown" }],
      [{ ...award, source: "battle-completed", amount: Number.MAX_SAFE_INTEGER }, { ...award, source: "activity-streak", eventId: "extra", amount: 1 }],
    ];
    for (const awards of malformed) {
      expect(preparePublishingXp(facts({ originalTrackId: "new" }), "account-a", { accountId: "account-a", awards } as LocalXpLedger, START)).toEqual({ eligible: false, reason: "invalid-ledger" });
    }
  });

  it("reuses Phase 1 totals/overflow protection and counts only publishing toward the allowance", () => {
    const other: XpAward = { accountId: "account-a", eventId: "battle:1", source: "battle-completed", occurredAt: START, amount: Number.MAX_SAFE_INTEGER - 50 };
    const ledger = processLocalXpAward(createLocalXpLedger("account-a"), other).ledger;
    const full = credit(ledger);
    expect(localXpProgress(full).lifetimeXp).toBe(Number.MAX_SAFE_INTEGER);
    expect(preparePublishingXp(facts({ originalTrackId: "next" }), "account-a", full, START)).toEqual({ eligible: false, reason: "overflow" });
    expect(processLocalXpAward(full, { ...other, eventId: "overflow", amount: 1 }).status).toBe("overflow");
  });

  it("uses collision-safe identity and produces deterministic, immutable valid events", () => {
    const first = preparePublishingXp(facts({ accountId: "a:b", originalTrackId: "c" }), "a:b", createLocalXpLedger("a:b"), START);
    const second = preparePublishingXp(facts({ accountId: "a", originalTrackId: "b:c" }), "a", createLocalXpLedger("a"), START);
    if (!first.eligible || !second.eligible) throw new Error("Expected prepared events");
    expect(first.award.eventId).not.toBe(second.award.eventId);
    expect(Object.isFrozen(first.award)).toBe(true);
    expect(preparePublishingXp(facts({ accountId: "a:b", originalTrackId: "c" }), "a:b", createLocalXpLedger("a:b"), START)).toEqual(first);
  });
});
