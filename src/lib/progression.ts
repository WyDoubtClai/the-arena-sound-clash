/**
 * Dormant account-XP domain, separate from Reputation and Ranked Points.
 * Nothing here grants real account XP or verifies that an activity occurred.
 * No app, battle, demo fixture, or persistence adapter is wired to this module.
 */
const MAX_XP = Number.MAX_SAFE_INTEGER;

function requireXp(xp: number): void {
  if (!Number.isSafeInteger(xp) || xp < 0) throw new RangeError("XP must be a nonnegative safe integer");
}

const threshold = (level: number): bigint => 25n * BigInt(level - 1) * BigInt(level + 6);

/** Cumulative XP to reach a level. Rejects thresholds beyond exact number precision. */
export function xpForLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1 || level > MAX_XP - 6) throw new RangeError("Invalid level");
  const total = threshold(level);
  if (total > BigInt(MAX_XP)) throw new RangeError("Level threshold exceeds supported XP");
  return Number(total);
}

export function levelFromXp(lifetimeXp: number): number {
  requireXp(lifetimeXp);
  // Estimate the quadratic root, then correct with exact integer comparisons.
  let level = Math.max(1, Math.floor((Math.sqrt(49 + lifetimeXp / 6.25) - 5) / 2));
  const xp = BigInt(lifetimeXp);
  while (threshold(level) > xp) level--;
  while (threshold(level + 1) <= xp) level++;
  return level;
}

/** Remaining XP, rather than the cumulative threshold for the next level. */
export function xpToNextLevel(lifetimeXp: number): number {
  return Number(threshold(levelFromXp(lifetimeXp) + 1) - BigInt(lifetimeXp));
}

export function xpProgress(lifetimeXp: number) {
  const level = levelFromXp(lifetimeXp);
  const levelStartXp = Number(threshold(level));
  const earnedInLevel = lifetimeXp - levelStartXp;
  const levelCost = 200 + 50 * (level - 1);
  return { lifetimeXp, level, levelStartXp, earnedInLevel, levelCost, xpToNextLevel: levelCost - earnedInLevel, fraction: earnedInLevel / levelCost };
}

export const XP_SOURCES = ["track-published", "beat-published", "battle-completed", "daily-challenge", "weekly-challenge", "activity-streak"] as const;
export type XpSource = (typeof XP_SOURCES)[number];

/** IDs belong to the owner/source domain, never a display name or filename. */
export type XpAward = Readonly<{
  accountId: string;
  eventId: string;
  source: XpSource;
  amount: number;
  occurredAt: number; // Unix milliseconds; supplied by the future trusted event producer.
  objectId?: string;
}>;

const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.trim() === value;

/** Structural validation only. Eligibility/amount policy and authorization need a trusted backend. */
export function isValidXpAward(value: unknown): value is XpAward {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return isId(event["accountId"]) && isId(event["eventId"])
    && XP_SOURCES.includes(event["source"] as XpSource)
    && Number.isSafeInteger(event["amount"]) && (event["amount"] as number) >= 0
    && Number.isSafeInteger(event["occurredAt"]) && (event["occurredAt"] as number) >= 0 && (event["occurredAt"] as number) <= 8.64e15
    && (event["objectId"] === undefined || isId(event["objectId"]));
}

export type LocalXpLedger = Readonly<{
  accountId: string;
  awards: readonly XpAward[];
}>;

/** In-memory/local simulation only; no seeded/historical XP or stored level. */
export function createLocalXpLedger(accountId: string): LocalXpLedger {
  if (!isId(accountId)) throw new RangeError("Invalid account ID");
  return Object.freeze({ accountId, awards: Object.freeze([]) });
}

export function localXpProgress(ledger: LocalXpLedger) {
  return xpProgress(ledger.awards.reduce((total, award) => total + award.amount, 0));
}

/**
 * Pure local reducer, NOT a production award endpoint. A future backend must
 * verify the source event, owner and amount, and atomically insert a unique
 * (accountId, eventId) record with the XP credit in the same transaction.
 * Local replay protection cannot prevent tampering or concurrent lost updates.
 */
export function processLocalXpAward(ledger: LocalXpLedger, value: unknown): {
  ledger: LocalXpLedger;
  status: "credited" | "duplicate" | "invalid" | "wrong-account" | "overflow";
} {
  if (!isValidXpAward(value)) return { ledger, status: "invalid" };
  if (value.accountId !== ledger.accountId) return { ledger, status: "wrong-account" };
  if (ledger.awards.some((award) => award.eventId === value.eventId)) return { ledger, status: "duplicate" };
  const total = localXpProgress(ledger).lifetimeXp;
  if (value.amount > MAX_XP - total) return { ledger, status: "overflow" };
  // Snapshot only contract fields so caller mutation cannot change earned XP.
  const award: XpAward = Object.freeze({
    accountId: value.accountId, eventId: value.eventId, source: value.source,
    amount: value.amount, occurredAt: value.occurredAt,
    ...(value.objectId === undefined ? {} : { objectId: value.objectId }),
  });
  return { ledger: Object.freeze({ accountId: ledger.accountId, awards: Object.freeze([...ledger.awards, award]) }), status: "credited" };
}
