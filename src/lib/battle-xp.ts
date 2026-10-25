import type { BattleFormat } from "./artist-battle";
import { isValidXpAward, type LocalXpLedger, type XpAward } from "./progression";

/** Dormant result policy only. None of the current demo battle results are trusted
 * authenticated final results. No route, timer, voting, audio, Vault or rating changes.
 */
export type BattleXpParticipant = Readonly<{
  participantId: string;
  accountId: string;
  authenticated: boolean;
  simulated: boolean;
  participationVerified: boolean;
  entryId: string | null;
  submissionValid: boolean;
  submissionEligible: boolean;
  placement: number | null;
  requiredJudgingComplete: boolean;
  judgingVerified: boolean;
}>;
type SupportedFormat = { division: "Artist"; format: BattleFormat } | { division: "Producer"; format: "sample-flip" };
export type FinalBattleXpResult = Readonly<SupportedFormat & {
  matchId: string;
  resultId: string;
  mode: "ranked" | "unranked";
  completed: boolean;
  finalized: boolean;
  valid: boolean;
  verified: boolean;
  demo: boolean;
  completedAt: number;
  finalizedAt: number;
  participants: readonly BattleXpParticipant[];
}>;
const PLACEMENT_XP = Object.freeze({
  ranked: Object.freeze([300, 225, 175, 125, 75, 75, 75, 75]),
  unranked: Object.freeze([150, 110, 90, 60, 40, 40, 40, 40]),
});
const JUDGING_XP = Object.freeze({ ranked: 25, unranked: 15 });
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.trim() === v;
const time = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 8.64e15;
const hasEntry = (p: BattleXpParticipant) => p.entryId !== null && p.submissionValid && p.submissionEligible;

function validResult(value: unknown): value is FinalBattleXpResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (!id(r["matchId"]) || !id(r["resultId"]) || !["ranked", "unranked"].includes(r["mode"] as string)
    || !(r["division"] === "Artist" ? ["creation", "song"].includes(r["format"] as string) : r["division"] === "Producer" && r["format"] === "sample-flip")
    || !time(r["completedAt"]) || !time(r["finalizedAt"]) || r["completedAt"] > r["finalizedAt"]
    || !["completed", "finalized", "valid", "verified", "demo"].every((k) => typeof r[k] === "boolean")
    || !Array.isArray(r["participants"]) || r["participants"].length !== 8) return false;
  const participants = r["participants"];
  for (const p of participants) {
    if (!p || typeof p !== "object" || !id(p.participantId) || !id(p.accountId) || !(p.entryId === null || id(p.entryId))
      || !["authenticated", "simulated", "participationVerified", "submissionValid", "submissionEligible", "requiredJudgingComplete", "judgingVerified"].every((k) => typeof p[k] === "boolean")
      || (hasEntry(p) ? !Number.isSafeInteger(p.placement) || p.placement < 1 || p.placement > 8 : p.placement !== null)) return false;
  }
  if (new Set(participants.map((p) => p.accountId)).size !== 8 || new Set(participants.map((p) => p.participantId)).size !== 8) return false;
  const entryIds = participants.filter((p) => p.entryId !== null).map((p) => p.entryId);
  if (new Set(entryIds).size !== entryIds.length) return false;
  const placements = participants.filter(hasEntry).map((p) => p.placement).sort((a, b) => a - b);
  return placements.every((place, index) => place === index + 1);
}

export type BattleXpDecision =
  | { status: "prepared"; awards: readonly XpAward[]; placementXp: number; judgingXp: number }
  | { status: "invalid-result" | "ineligible" | "wrong-participant" | "invalid-ledger" | "reconciliation-required" | "overflow" };

/**
 * Stable reward uniqueness is (account, match, category), not result ID alone:
 * a new result ID/revision/participant alias cannot reward the same match again.
 * objectId binds the whole canonical finalized result, including judging/entries.
 * We store an exact canonical snapshot instead of trusting a client-supplied digest;
 * a future backend can use an authoritative immutable result digest/reference.
 *
 * Production must authenticate the principal, independently validate submissions,
 * resolve/tie-break placements, verify required judging and all eight participants,
 * and freeze the result before calling. Persist both rewards atomically with match
 * uniqueness. Local flags, IDs and canonicalization establish no real authenticity;
 * complete authoritative reward history is required to detect previous awards.
 */
export function prepareBattleXp(value: unknown, trustedAccountId: string, participantId: string, ledger: LocalXpLedger, now: number): BattleXpDecision {
  if (!time(now) || !validResult(value) || value.finalizedAt > now) return { status: "invalid-result" };
  if (!value.completed || !value.finalized || !value.valid || !value.verified || value.demo
    || value.participants.some((p) => !p.authenticated || !p.participationVerified || p.simulated)) return { status: "ineligible" };
  const participant = value.participants.find((p) => p.accountId === trustedAccountId && p.participantId === participantId);
  if (!id(trustedAccountId) || !id(participantId) || !participant) return { status: "wrong-participant" };
  if (!ledger || ledger.accountId !== trustedAccountId || !Array.isArray(ledger.awards)) return { status: "invalid-ledger" };
  let total = 0;
  const seen = new Set<string>();
  for (const a of ledger.awards) {
    if (!isValidXpAward(a) || a.accountId !== trustedAccountId || a.occurredAt > now || seen.has(a.eventId) || a.amount > Number.MAX_SAFE_INTEGER - total) return { status: "invalid-ledger" };
    total += a.amount; seen.add(a.eventId);
    if (a.source === "battle-completed" && a.objectId?.startsWith("battle-result:")) {
      try {
        const prior: unknown = JSON.parse(a.objectId.slice(14));
        if (!Array.isArray(prior) || !id(prior[0]) || !id(prior[1])) return { status: "invalid-ledger" };
        if (prior[1] === value.resultId && prior[0] !== value.matchId) return { status: "reconciliation-required" };
      } catch { return { status: "invalid-ledger" }; }
    }
  }
  const canonical = JSON.stringify([value.matchId, value.resultId, value.division, value.format, value.mode, value.completedAt, value.finalizedAt,
    [...value.participants].sort((a, b) => a.participantId < b.participantId ? -1 : a.participantId > b.participantId ? 1 : 0).map((p) => [p.participantId, p.accountId,
      p.authenticated, p.simulated, p.participationVerified, p.entryId, p.submissionValid, p.submissionEligible, p.placement, p.requiredJudgingComplete, p.judgingVerified])]);
  const objectId = `battle-result:${canonical}`;
  const placementXp = hasEntry(participant) ? PLACEMENT_XP[value.mode][participant.placement! - 1] : 0;
  const judgingXp = hasEntry(participant) && participant.requiredJudgingComplete && participant.judgingVerified ? JUDGING_XP[value.mode] : 0;
  const pending: XpAward[] = [];
  for (const [category, amount] of [["placement", placementXp], ["judging", judgingXp]] as const) {
    const eventId = `battle:${JSON.stringify([trustedAccountId, value.matchId, category])}`;
    const prior = ledger.awards.find((a) => a.eventId === eventId);
    if (prior) {
      if (prior.source !== "battle-completed" || prior.objectId !== objectId || prior.amount !== amount || prior.occurredAt !== value.finalizedAt) return { status: "reconciliation-required" };
    } else if (amount) pending.push(Object.freeze({ accountId: trustedAccountId, eventId, source: "battle-completed", amount, occurredAt: value.finalizedAt, objectId }));
  }
  if (pending.reduce((sum, a) => sum + a.amount, 0) > Number.MAX_SAFE_INTEGER - total) return { status: "overflow" };
  return { status: "prepared", awards: Object.freeze(pending), placementXp, judgingXp };
}
