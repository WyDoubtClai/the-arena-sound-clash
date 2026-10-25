import { isValidXpAward, type LocalXpLedger, type XpAward } from "./progression";

/** Policy preparation only. These facts must eventually come from trusted backend records,
 * never a request body, filename, selected role, display name, or demo catalog fixture.
 * There is no authenticated publisher in the current app, so nothing calls this from UI.
 */
export type PublicationFacts = Readonly<{
  publicationId: string;
  accountId: string;
  originalTrackId: string;
  kind: "song" | "beat";
  operation: "first-publication" | "edit" | "crate-listing" | "reupload";
  status: "draft" | "published";
  originalVerified: boolean;
  provenanceVerified: boolean;
  publicationVerified: boolean;
  demo: boolean;
  firstPublishedAt: number;
}>;

export const PUBLISHING_XP = 50;
export const PUBLISHING_LIMIT = 5;
export const PUBLISHING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const id = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.trim() === value;
const timestamp = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 8.64e15;
const publishingSource = (award: XpAward) => award.source === "track-published" || award.source === "beat-published";

/** Same original/account identity across roles, reuploads, listing IDs, and song/beat paths. */
function publishingRewardId(accountId: string, originalTrackId: string): string {
  return `publishing:${JSON.stringify([accountId, originalTrackId])}`;
}

function validFacts(value: unknown): value is PublicationFacts {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const facts = value as Record<string, unknown>;
  return id(facts["publicationId"]) && id(facts["accountId"]) && id(facts["originalTrackId"])
    && ["song", "beat"].includes(facts["kind"] as string)
    && ["first-publication", "edit", "crate-listing", "reupload"].includes(facts["operation"] as string)
    && ["draft", "published"].includes(facts["status"] as string)
    && ["originalVerified", "provenanceVerified", "publicationVerified", "demo"].every((key) => typeof facts[key] === "boolean")
    && timestamp(facts["firstPublishedAt"]);
}

export type PublishingDecision =
  | { eligible: true; award: XpAward }
  | { eligible: false; reason: "invalid-publication" | "wrong-account" | "ineligible" | "invalid-ledger" | "duplicate" | "out-of-order" | "allowance-exhausted" | "overflow" };

/**
 * Pure eligibility evaluation; does not change a ledger, publish, persist or issue XP.
 * `authenticatedAccountId` is a future trusted principal, not simulated authentication.
 *
 * Backend prerequisites: immutable firstPublishedAt and canonical originalTrackId survive
 * deletion/reupload; verify ownership/originality/publication; retain complete award history;
 * serialize first-publication decisions in occurrence order per account. Atomically check
 * the allowance and insert the original/account reward with XP in one transaction.
 * No local check here protects against fabricated facts, tampering or concurrency.
 */
export function preparePublishingXp(
  publication: unknown,
  authenticatedAccountId: string,
  ledger: LocalXpLedger,
  now: number,
): PublishingDecision {
  if (!timestamp(now) || !validFacts(publication) || publication.firstPublishedAt > now) return { eligible: false, reason: "invalid-publication" };
  if (!id(authenticatedAccountId) || publication.accountId !== authenticatedAccountId || ledger?.accountId !== authenticatedAccountId) return { eligible: false, reason: "wrong-account" };
  if (publication.demo || publication.status !== "published" || publication.operation !== "first-publication"
    || !publication.originalVerified || !publication.provenanceVerified || !publication.publicationVerified) return { eligible: false, reason: "ineligible" };

  if (!Array.isArray(ledger.awards)) return { eligible: false, reason: "invalid-ledger" };
  let total = 0;
  const seen = new Set<string>();
  const publishing: XpAward[] = [];
  for (const award of ledger.awards) {
    if (!isValidXpAward(award) || award.accountId !== authenticatedAccountId || award.occurredAt > now || seen.has(award.eventId)
      || award.amount > Number.MAX_SAFE_INTEGER - total) return { eligible: false, reason: "invalid-ledger" };
    seen.add(award.eventId);
    total += award.amount;
    if (publishingSource(award)) {
      if (award.amount !== PUBLISHING_XP || !id(award.objectId)
        || award.eventId !== publishingRewardId(award.accountId, award.objectId)) return { eligible: false, reason: "invalid-ledger" };
      publishing.push(award);
    }
  }
  const eventId = publishingRewardId(authenticatedAccountId, publication.originalTrackId);
  if (seen.has(eventId) || publishing.some((award) => award.objectId === publication.originalTrackId)) return { eligible: false, reason: "duplicate" };
  // Late, previously unseen events need backend reconciliation, not a reward against a
  // different window. Replays of an already credited original were handled above.
  if (publishing.some((award) => award.occurredAt > publication.firstPublishedAt)) return { eligible: false, reason: "out-of-order" };
  // Exact window: (firstPublishedAt - 7 days, firstPublishedAt]. At precisely seven
  // days an old award expires. Anchor to publication time, NEVER retry/processing time.
  const recent = publishing.filter((award) => award.occurredAt > publication.firstPublishedAt - PUBLISHING_WINDOW_MS);
  if (recent.length >= PUBLISHING_LIMIT) return { eligible: false, reason: "allowance-exhausted" };
  if (PUBLISHING_XP > Number.MAX_SAFE_INTEGER - total) return { eligible: false, reason: "overflow" };
  const award: XpAward = Object.freeze({
    accountId: authenticatedAccountId, eventId,
    source: publication.kind === "song" ? "track-published" : "beat-published",
    amount: PUBLISHING_XP, occurredAt: publication.firstPublishedAt,
    objectId: publication.originalTrackId,
  });
  return { eligible: true, award };
}
