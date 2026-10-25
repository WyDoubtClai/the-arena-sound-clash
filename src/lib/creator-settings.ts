import { useEffect, useState } from "react";
import { canEditProfile, type ProfileId } from "./profile-demo";
import { assignDailyChallenges, type CreatorRoles, type DailyChallengeRecord } from "./daily-challenges";

export const CREATOR_ROLE_OPTIONS = ["Rapper", "Producer", "Both"] as const;
export type CreatorRole = (typeof CREATOR_ROLE_OPTIONS)[number];
export const isCreatorRole = (value: unknown): value is CreatorRole => CREATOR_ROLE_OPTIONS.includes(value as CreatorRole);
export const creatorRoleLabel = (role: CreatorRole) => role === "Both" ? "Rapper & Producer" : role;
export const challengeRole = (role: CreatorRole): CreatorRoles => role === "Rapper" ? "Artist" : role;
export const creatorSettingsKey = (profileId: ProfileId) => `arena-creator-settings-v1:${profileId}`;
const SETTINGS_EVENT = "arena-creator-settings";
export type CreatorSettings = Readonly<{ version: 1; accountId: ProfileId; creatorRole: CreatorRole }>;

/** Missing/legacy data needs explicit selection. Never infer it from sample badges,
 * competitive records, uploaded content or the currently previewed profile role.
 */
export function parseCreatorSettings(text: string | null, profileId: ProfileId): CreatorSettings | null {
  try {
    const value = JSON.parse(text ?? "null");
    return value?.version === 1 && value.accountId === profileId && isCreatorRole(value.creatorRole)
      ? Object.freeze({ version: 1, accountId: profileId, creatorRole: value.creatorRole }) : null;
  } catch { return null; }
}

export function readCreatorSettings(profileId: ProfileId): CreatorSettings | null {
  return parseCreatorSettings(window.localStorage.getItem(creatorSettingsKey(profileId)), profileId);
}

/** Uses the existing editable demo identity (Blaze). This is NOT authentication or
 * production authorization. Browser data can be changed outside the application.
 * Persist only this setting; never mutate fixtures, music, records, XP or daily state.
 */
export function saveCreatorRole(profileId: ProfileId, value: unknown): "saved" | "forbidden" | "invalid" | "storage-unavailable" {
  if (!canEditProfile(profileId)) return "forbidden";
  if (!isCreatorRole(value)) return "invalid";
  try {
    window.localStorage.setItem(creatorSettingsKey(profileId), JSON.stringify({ version: 1, accountId: profileId, creatorRole: value }));
  } catch { return "storage-unavailable"; }
  window.dispatchEvent(new Event(SETTINGS_EVENT));
  return "saved";
}

/** Same post-hydration/browser-storage pattern used by the existing Beat Vault. */
export function useCreatorSettings(profileId: ProfileId) {
  const [state, setState] = useState<{ profileId: ProfileId; settings: CreatorSettings | null; loaded: boolean; storageError: boolean }>({ profileId, settings: null, loaded: false, storageError: false });
  useEffect(() => {
    const sync = () => {
      try { setState({ profileId, settings: readCreatorSettings(profileId), loaded: true, storageError: false }); }
      catch { setState({ profileId, settings: null, loaded: true, storageError: true }); }
    };
    sync();
    window.addEventListener(SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(SETTINGS_EVENT, sync); window.removeEventListener("storage", sync); };
  }, [profileId]);
  // Never show a previous profile's saved selection while switching previews.
  return state.profileId === profileId ? state : { profileId, settings: null, loaded: false, storageError: false };
}

/** Dormant daily-policy adapter, not a scheduler or XP issuer. The caller MUST load
 * the authoritative account/day record before calling, passing null explicitly only
 * when none exists. This app has no trusted daily persistence; missing history cannot
 * be detected here. Do not hook unverified demo activity into challenge XP.
 * Existing snapshots take precedence over every later Settings change, even if the
 * saved role is missing/unavailable. New assignments read SAVED data, not form drafts.
 * Day keys still use the Phase 3 UTC boundary; reset is 00:00 UTC, not local midnight.
 */
export function dailyFromSavedCreatorRole(profileId: ProfileId, dayKey: string, existing: DailyChallengeRecord | null): DailyChallengeRecord | null {
  if (existing) return assignDailyChallenges(profileId, dayKey, existing.roleAtAssignment, existing);
  const settings = readCreatorSettings(profileId);
  if (!settings) return null;
  return assignDailyChallenges(profileId, dayKey, challengeRole(settings.creatorRole));
}
