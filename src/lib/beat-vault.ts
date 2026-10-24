// Phase 1 Beat Vault: browser-local giveaway rewards. Demo-only protection, not production security.
import { useEffect, useState } from "react";
import type { Beat } from "./data";

export type RewardStatus = "awarded" | "claimed";
export type VaultReward = {
  id: string; battleId: string; battleName: string; artistId: string; beatId: string; beatTitle: string;
  producer: string; awardedAt: string; status: RewardStatus; seed: number; seconds: number;
};
export const VAULT_KEY = "arena-beat-vault-v1";
const EVENT = "arena-beat-vault";

export const rewardId = (battleId: string, beatId: string) => `${battleId}:${beatId}`;
export const newBattleId = (now = Date.now(), rand = Math.random()) => `aqb-${now.toString(36)}-${Math.floor(rand * 1e6).toString(36)}`;

/** Only the first-place artist of a Creation Battle on a Winner Giveaway / Buy It or Win It beat qualifies. */
export function qualifiesForReward(format: string, beat: Pick<Beat, "giveaway"> | undefined, firstPlaceId: string | undefined, artistId: string) {
  return format === "creation" && !!beat?.giveaway && firstPlaceId === artistId;
}
export const reservedBeatIds = (list: VaultReward[]) => new Set(list.map((r) => r.beatId));
export const vaultStatus = (list: VaultReward[], beatId: string): "available" | RewardStatus => list.find((r) => r.beatId === beatId)?.status ?? "available";

/** Adds a reward once per battle; a beat already reserved by another award is never awarded twice. */
export function awardReward(list: VaultReward[], reward: VaultReward): VaultReward[] {
  if (list.some((r) => r.id === reward.id || r.beatId === reward.beatId)) return list;
  return [...list, reward];
}
export const canDownloadReward = (reward: VaultReward, viewerId: string) => reward.artistId === viewerId;
export function claimReward(list: VaultReward[], id: string, viewerId: string): VaultReward[] {
  return list.map((r) => (r.id === id && canDownloadReward(r, viewerId) ? { ...r, status: "claimed" } : r));
}
export const rewardsFor = (list: VaultReward[], artistId: string) => list.filter((r) => r.artistId === artistId);

export function parseVault(text: string | null): VaultReward[] {
  try { const v = JSON.parse(text ?? "[]"); return Array.isArray(v) ? v.filter((r) => r && typeof r.id === "string" && typeof r.beatId === "string") : []; } catch { return []; }
}
export function readVault(): VaultReward[] {
  try { return parseVault(window.localStorage.getItem(VAULT_KEY)); } catch { return []; }
}
export function writeVault(list: VaultReward[]) {
  try { window.localStorage.setItem(VAULT_KEY, JSON.stringify(list)); } catch { /* storage unavailable: session only */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Shared hook: the Results screen, Profile and Crate all read the same saved records. Loads after hydration. */
export function useVault() {
  const [list, setList] = useState<VaultReward[]>([]);
  useEffect(() => {
    const sync = () => setList(readVault());
    sync();
    window.addEventListener(EVENT, sync); window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return {
    list,
    award: (reward: VaultReward) => writeVault(awardReward(readVault(), reward)),
    claim: (id: string, viewerId: string) => writeVault(claimReward(readVault(), id, viewerId)),
    reset: () => writeVault([]),
  };
}
