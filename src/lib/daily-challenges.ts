import { isValidXpAward, type LocalXpLedger, type XpAward } from "./progression";

/** Dormant policy only: no UI, persistence, authentication, or real XP issuance.
 * Verified facts below are assertions supplied by a future trusted event producer,
 * not proof established by this module. Existing demos must never supply them.
 */
export type CreatorRoles = "Artist" | "Producer" | "Both";
export type Difficulty = "easy" | "medium" | "hard";
export type ActivityType = "music-listened" | "meaningful-comment" | "battle-completed";
export const DAILY_CATALOG_VERSION = 1;
export const DAILY_XP = Object.freeze({ easy: 15, medium: 25, hard: 40, bonus: 20 });
const DAY_MS = 86_400_000;
const slots = ["easy", "medium", "hard"] as const;
const roles = ["Artist", "Producer", "Both"] as const;
const isId = (value: unknown): value is string => typeof value === "string" && value.trim() === value && value.length > 0;
const isTime = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 8.64e15;

/** Version 1 explicitly uses UTC calendar days, independent of device timezone/DST.
 * Production must choose the key using its authoritative clock and persist the
 * assignment uniquely by (accountId, dayKey), never by role or catalog version.
 */
export function dailyDayBounds(dayKey: string) {
  if (typeof dayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new RangeError("Invalid UTC day");
  const start = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!isTime(start) || new Date(start).toISOString().slice(0, 10) !== dayKey) throw new RangeError("Invalid UTC day");
  return { start, end: start + DAY_MS, timezone: "UTC" as const };
}

export type ChallengeDefinition = Readonly<{
  id: string;
  version: 1;
  role: CreatorRoles;
  difficulty: Difficulty;
  xp: number;
  objectiveType: "distinct-music-creators" | "distinct-comment-creators" | "battle-or-community";
  requiredMusic: number;
  requiredComments: number;
  requiredBattles: number;
  requireBothMedia: boolean;
  allowedEventTypes: readonly ActivityType[];
  completionRequirements: string;
}>;

// Small curated pool: two easy and medium variants plus one dual-path hard per role.
// Future catalogs must retain old versions; no automatic replacements or rerolls.
export const DAILY_CHALLENGES: readonly ChallengeDefinition[] = Object.freeze(roles.flatMap((role) =>
  slots.flatMap((difficulty) => (difficulty === "hard" ? [0] : [0, 1]).map((variant): ChallengeDefinition => Object.freeze({
    id: `${role.toLowerCase()}-${difficulty}-${variant + 1}`, version: 1, role, difficulty, xp: DAILY_XP[difficulty],
    objectiveType: difficulty === "easy" ? "distinct-music-creators" : difficulty === "medium" ? "distinct-comment-creators" : "battle-or-community",
    requiredMusic: difficulty === "medium" ? 0 : difficulty === "hard" ? 3 : 2 + variant,
    requiredComments: difficulty === "easy" ? 0 : difficulty === "hard" ? 2 : 1 + variant,
    requiredBattles: difficulty === "hard" ? 1 : 0,
    requireBothMedia: role === "Both",
    allowedEventTypes: Object.freeze(difficulty === "hard" ? ["music-listened", "meaningful-comment", "battle-completed"] : [difficulty === "easy" ? "music-listened" : "meaningful-comment"]) as readonly ActivityType[],
    completionRequirements: difficulty === "hard"
      ? "Complete one eligible battle OR listen to three distinct other creators and leave meaningful comments for two distinct other creators. Both roles: include songs and beats."
      : difficulty === "easy" ? "Qualified listening to distinct other creators; songs through Discover or beats through Crate. Both roles: include both media."
        : "Meaningful, nonduplicate comments on posts from distinct other creators in the assigned community.",
  }))),
));

/** Future producer requirements: authenticated actor ID; immutable occurrence time
 * and activity ID; canonical track IDs across catalog mirrors; canonical post owner;
 * server-qualified listening (not play clicks); moderated meaningful/nonspam comments
 * with normalized-content fingerprints; genuine completed battles with verified
 * participation. Reuse actual content/battle IDs only after this validation exists.
 * A browser's IDs, clock, flags or hashes cannot establish any of these facts.
 */
type ActivityBase = Readonly<{ eventId: string; accountId: string; occurredAt: number; verified: boolean; demo: boolean }>;
export type VerifiedDailyActivity = ActivityBase & (
  | Readonly<{ type: "music-listened"; trackId: string; creatorId: string; media: "song" | "beat"; surface: "discover" | "crate"; qualifiedListen: boolean }>
  | Readonly<{ type: "meaningful-comment"; commentId: string; postId: string; creatorId: string; creatorRole: "Artist" | "Producer"; contentFingerprint: string; meaningful: boolean; duplicateContent: boolean }>
  | Readonly<{ type: "battle-completed"; battleId: string; battleRole: "Artist" | "Producer"; validCompletion: boolean; eligibleBattle: boolean; simulatedParticipants: boolean }>
);

function validActivity(value: unknown): value is VerifiedDailyActivity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (!isId(v["eventId"]) || !isId(v["accountId"]) || !isTime(v["occurredAt"])
    || typeof v["verified"] !== "boolean" || typeof v["demo"] !== "boolean") return false;
  switch (v["type"]) {
    case "music-listened": return isId(v["trackId"]) && isId(v["creatorId"]) && ["song", "beat"].includes(v["media"] as string)
      && ["discover", "crate"].includes(v["surface"] as string) && typeof v["qualifiedListen"] === "boolean";
    case "meaningful-comment": return isId(v["commentId"]) && isId(v["postId"]) && isId(v["creatorId"]) && ["Artist", "Producer"].includes(v["creatorRole"] as string)
      && isId(v["contentFingerprint"]) && typeof v["meaningful"] === "boolean" && typeof v["duplicateContent"] === "boolean";
    case "battle-completed": return isId(v["battleId"]) && ["Artist", "Producer"].includes(v["battleRole"] as string)
      && ["validCompletion", "eligibleBattle", "simulatedParticipants"].every((k) => typeof v[k] === "boolean");
    default: return false;
  }
}

function eligibleActivity(event: VerifiedDailyActivity, role: CreatorRoles): boolean {
  if (!event.verified || event.demo) return false;
  if (event.type === "battle-completed") return event.validCompletion && event.eligibleBattle && !event.simulatedParticipants && (role === "Both" || event.battleRole === role);
  if (event.creatorId === event.accountId) return false;
  if (event.type === "meaningful-comment") return event.meaningful && !event.duplicateContent && (role === "Both" || event.creatorRole === role);
  return event.qualifiedListen && (event.media === "song" ? event.surface === "discover" && role !== "Producer" : event.surface === "crate" && role !== "Artist");
}

// Activity identity is distinct from reward identity. New delivery IDs cannot count
// the same track/comment/battle again, or identical normalized comment content.
function activityKeys(event: VerifiedDailyActivity): string[] {
  return [`event:${event.eventId}`, ...(event.type === "music-listened" ? [`track:${event.trackId}`]
    : event.type === "battle-completed" ? [`battle:${event.battleId}`]
      : [`comment:${event.commentId}`, `content:${event.contentFingerprint}`])];
}

export type DailyChallengeRecord = Readonly<{
  accountId: string;
  dayKey: string;
  timezone: "UTC";
  catalogVersion: 1;
  roleAtAssignment: CreatorRoles;
  challengeIds: readonly string[];
  activities: readonly VerifiedDailyActivity[];
}>;

function assignedIds(accountId: string, dayKey: string, role: CreatorRoles): readonly string[] {
  return Object.freeze(slots.map((difficulty) => {
    const pool = DAILY_CHALLENGES.filter((c) => c.role === role && c.difficulty === difficulty);
    let hash = 2166136261;
    for (const char of JSON.stringify([accountId, dayKey, DAILY_CATALOG_VERSION, role, difficulty])) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    return pool[hash % pool.length].id;
  }));
}

function validRecord(record: DailyChallengeRecord): boolean {
  try {
    if (!record || !isId(record.accountId) || record.timezone !== "UTC" || record.catalogVersion !== 1 || !roles.includes(record.roleAtAssignment)
      || !Array.isArray(record.challengeIds) || !Array.isArray(record.activities)) return false;
    const { start, end } = dailyDayBounds(record.dayKey);
    if (JSON.stringify(record.challengeIds) !== JSON.stringify(assignedIds(record.accountId, record.dayKey, record.roleAtAssignment))) return false;
    const seen = new Set<string>();
    for (const event of record.activities) {
      if (!validActivity(event) || event.accountId !== record.accountId || event.occurredAt < start || event.occurredAt >= end || !eligibleActivity(event, record.roleAtAssignment)) return false;
      const keys = activityKeys(event);
      if (keys.some((key) => seen.has(key))) return false;
      keys.forEach((key) => seen.add(key));
    }
    return true;
  } catch { return false; }
}

/** Caller MUST load the account/day record first. Missing records cannot be detected
 * locally. Existing assignments remain fixed across role switches and navigation.
 */
export function assignDailyChallenges(accountId: string, dayKey: string, role: CreatorRoles, existing?: DailyChallengeRecord): DailyChallengeRecord {
  dailyDayBounds(dayKey);
  if (!isId(accountId) || !roles.includes(role)) throw new RangeError("Invalid assignment identity or role");
  if (existing) {
    if (!validRecord(existing) || existing.accountId !== accountId || existing.dayKey !== dayKey) throw new RangeError("Mismatched daily record");
    return existing;
  }
  return Object.freeze({ accountId, dayKey, timezone: "UTC", catalogVersion: 1, roleAtAssignment: role,
    challengeIds: assignedIds(accountId, dayKey, role), activities: Object.freeze([]) });
}

/** Accepts late/out-of-order events for their ORIGINAL day, never the arrival day.
 * Version 1 has no lateness cutoff; authoritative backend closure/reconciliation is
 * required before a future weekly policy treats a day as final. No real clock reads.
 */
export function applyDailyActivity(record: DailyChallengeRecord, value: unknown, now: number): {
  record: DailyChallengeRecord; status: "accepted" | "duplicate" | "invalid" | "wrong-account" | "wrong-day" | "ineligible";
} {
  if (!isTime(now) || !validRecord(record) || !validActivity(value) || value.occurredAt > now || record.activities.some((e) => e.occurredAt > now)) return { record, status: "invalid" };
  if (value.accountId !== record.accountId) return { record, status: "wrong-account" };
  const { start, end } = dailyDayBounds(record.dayKey);
  if (value.occurredAt < start || value.occurredAt >= end) return { record, status: "wrong-day" };
  if (!eligibleActivity(value, record.roleAtAssignment)) return { record, status: "ineligible" };
  const keys = new Set(record.activities.flatMap(activityKeys));
  if (activityKeys(value).some((key) => keys.has(key))) return { record, status: "duplicate" };
  const event = Object.freeze({ ...value });
  return { record: Object.freeze({ ...record, activities: Object.freeze([...record.activities, event]) }), status: "accepted" };
}

function progressFor(def: ChallengeDefinition, events: readonly VerifiedDailyActivity[]) {
  const creators = new Set<string>(), media = new Set<string>(), commenters = new Set<string>();
  let battles = 0, completedAt: number | null = null;
  for (const event of [...events].sort((a, b) => a.occurredAt - b.occurredAt || (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0))) {
    if (event.type === "music-listened") { creators.add(event.creatorId); media.add(event.media); }
    if (event.type === "meaningful-comment") commenters.add(event.creatorId);
    if (event.type === "battle-completed") battles++;
    const musicDone = creators.size >= def.requiredMusic && (!def.requireBothMedia || def.requiredMusic === 0 || media.size === 2);
    const communityDone = musicDone && commenters.size >= def.requiredComments;
    const done = def.objectiveType === "distinct-music-creators" ? musicDone
      : def.objectiveType === "distinct-comment-creators" ? commenters.size >= def.requiredComments
        : battles >= def.requiredBattles || communityDone;
    if (done && completedAt === null) completedAt = event.occurredAt;
  }
  return { challengeId: def.id, difficulty: def.difficulty, xp: def.xp, musicCreators: creators.size,
    mediaKinds: media.size, commentCreators: commenters.size, battles, requiredMusic: def.requiredMusic,
    requiredComments: def.requiredComments, requiredBattles: def.requiredBattles, completedAt, complete: completedAt !== null };
}

export function dailyChallengeProgress(record: DailyChallengeRecord) {
  if (!validRecord(record)) throw new RangeError("Invalid daily record");
  return record.challengeIds.map((id) => progressFor(DAILY_CHALLENGES.find((c) => c.id === id)!, record.activities));
}

export type DailyCompletionRecord = Readonly<{
  accountId: string; dayKey: string; timezone: "UTC"; catalogVersion: 1;
  completedChallengeIds: readonly string[]; allThreeCompleted: boolean; completedAt: number | null;
}>;

// A slot is the stable account/day challenge identity; its definition/version lives
// in objectId. Excluding role/catalog from reward identity prevents reroll rewards.
const dailyRewardId = (accountId: string, dayKey: string, slot: Difficulty | "bonus") => `daily:${JSON.stringify([accountId, dayKey, slot])}`;

/** Prepares a batch of Phase 1 events; does NOT credit XP or maintain XP totals.
 * Backend must atomically store progress, event deduplication, rewards and the +20
 * bonus using account/day/slot uniqueness. Require complete authoritative history;
 * validation cannot prove completeness, authenticity, or atomic concurrency safety.
 */
export function prepareDailyChallengeXp(record: DailyChallengeRecord, ledger: LocalXpLedger, now: number):
  | { status: "prepared"; awards: readonly XpAward[]; completion: DailyCompletionRecord }
  | { status: "invalid-record" | "wrong-account" | "invalid-ledger" | "overflow" } {
  if (!isTime(now) || !validRecord(record) || record.activities.some((e) => e.occurredAt > now)) return { status: "invalid-record" };
  if (!ledger || ledger.accountId !== record.accountId) return { status: "wrong-account" };
  if (!Array.isArray(ledger.awards)) return { status: "invalid-ledger" };
  const progress = dailyChallengeProgress(record);
  const expected = progress.map((p) => ({ slot: p.difficulty, objectId: `v1:${p.challengeId}`, amount: p.xp, at: p.completedAt }));
  const allThreeCompleted = progress.every((p) => p.complete);
  const completedAt = allThreeCompleted ? Math.max(...progress.map((p) => p.completedAt!)) : null;
  const candidates = [...expected, { slot: "bonus" as const, objectId: "v1:all-three", amount: DAILY_XP.bonus, at: completedAt }];
  const seen = new Set<string>();
  let total = 0;
  for (const award of ledger.awards) {
    if (!isValidXpAward(award) || award.accountId !== record.accountId || award.occurredAt > now || seen.has(award.eventId)
      || award.amount > Number.MAX_SAFE_INTEGER - total) return { status: "invalid-ledger" };
    total += award.amount;
    seen.add(award.eventId);
    if (award.source === "daily-challenge") {
      try {
        if (!award.eventId.startsWith("daily:")) return { status: "invalid-ledger" };
        const key: unknown = JSON.parse(award.eventId.slice(6));
        if (!Array.isArray(key) || key.length !== 3 || key[0] !== record.accountId || typeof key[1] !== "string" || ![...slots, "bonus"].includes(key[2])) return { status: "invalid-ledger" };
        const [account, day, slot] = key as [string, string, Difficulty | "bonus"];
        const bounds = dailyDayBounds(day);
        const definition = DAILY_CHALLENGES.find((c) => `v1:${c.id}` === award.objectId && c.difficulty === slot);
        if (award.eventId !== dailyRewardId(account, day, slot) || award.amount !== DAILY_XP[slot] || award.occurredAt < bounds.start || award.occurredAt >= bounds.end
          || (slot === "bonus" ? award.objectId !== "v1:all-three" : !definition)) return { status: "invalid-ledger" };
        if (day === record.dayKey && !candidates.some((c) => c.slot === slot && c.objectId === award.objectId && c.at !== null)) return { status: "invalid-ledger" };
      } catch { return { status: "invalid-ledger" }; }
    }
  }
  const awards: XpAward[] = candidates.filter((c) => c.at !== null && !seen.has(dailyRewardId(record.accountId, record.dayKey, c.slot))).map((c) => Object.freeze({
    accountId: record.accountId, eventId: dailyRewardId(record.accountId, record.dayKey, c.slot), source: "daily-challenge" as const,
    amount: c.amount, occurredAt: c.at!, objectId: c.objectId,
  }));
  if (awards.reduce((sum, a) => sum + a.amount, 0) > Number.MAX_SAFE_INTEGER - total) return { status: "overflow" };
  return { status: "prepared", awards: Object.freeze(awards), completion: Object.freeze({ accountId: record.accountId,
    dayKey: record.dayKey, timezone: "UTC", catalogVersion: 1,
    completedChallengeIds: Object.freeze(progress.filter((p) => p.complete).map((p) => p.challengeId)), allThreeCompleted, completedAt }) };
}
