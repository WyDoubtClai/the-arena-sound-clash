import { z } from "zod";
import { challengeRole, creatorRoleLabel } from "./creator-settings";

export const creatorRoleSchema = z.enum(["Rapper", "Producer", "Both", "Fan"]);
export type AccountRole = z.infer<typeof creatorRoleSchema>;
export const accountRoleLabel = (role: AccountRole) => role === "Fan" ? "Fan" : creatorRoleLabel(role);
// No Fan challenge catalog exists. Never coerce a Fan to Artist/Producer/Both.
export const accountChallengeRole = (role: AccountRole) => role === "Fan" ? null : challengeRole(role);
export const RECORDING_SETUPS = ["Home studio", "Phone/tablet/computer recording app", "External studio or limited access"] as const;
export const RECORDING_CAPABILITIES = ["Yes", "Sometimes", "No"] as const;
export const recordingSchema = z.object({
  recording_setup: z.enum(RECORDING_SETUPS).nullable(),
  can_record_15m: z.enum(RECORDING_CAPABILITIES).nullable(),
  revision: z.number().int().nonnegative().safe().nullable(),
}).strict();
export type RecordingPreferences = z.infer<typeof recordingSchema>;
export const RECORDING_COLUMNS = "recording_setup,can_record_15m,revision";
export const handleSchema = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,29}$/, "Use 3–30 letters, numbers or underscores, starting with a letter.")
  .refine((s) => !["blaze", "tonemadelt", "judgeraye", "admin", "support", "arena"].includes(s), "This handle is reserved.");
const fields = {
  display_name: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(500),
  location: z.string().trim().max(100),
};
export const profileCreateSchema = z.object({ handle: handleSchema, ...fields, creator_role: creatorRoleSchema }).strict();
export const profileEditSchema = z.object({ ...fields, revision: z.number().int().nonnegative().safe() }).strict();
export const roleEditSchema = z.object({ creator_role: creatorRoleSchema, revision: z.number().int().nonnegative().safe() }).strict();
const email = z.string().trim().email().max(254);
const password = z.string().min(12, "Use at least 12 characters.").max(128);
// Preserve Zod 3's UUID-shaped input contract; verified Auth still establishes ownership.
const accountId = z.guid();
export const accountActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("signup"), email, password }).strict(),
  z.object({ action: z.literal("signin"), email, password: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal("recover"), email }).strict(),
  z.object({ action: z.literal("resend"), email }).strict(),
  z.object({ action: z.literal("exchange"), code: z.string().min(1).max(4096) }).strict(),
  z.object({ action: z.literal("password"), accountId, password }).strict(),
  z.object({ action: z.literal("signout") }).strict(),
  z.object({ action: z.literal("create-profile"), accountId, profile: profileCreateSchema }).strict(),
  z.object({ action: z.literal("edit-profile"), accountId, profile: profileEditSchema }).strict(),
  z.object({ action: z.literal("recording"), accountId, preferences: recordingSchema }).strict(),
  z.object({ action: z.literal("role"), accountId, profile: roleEditSchema }).strict(),
]);
export type AccountAction = z.infer<typeof accountActionSchema>;
export type CreatorProfile = {
  account_id: string; handle: string; display_name: string; bio: string; location: string;
  creator_role: AccountRole; revision: number; created_at: string; updated_at: string;
};
export type AccountState = { user: { id: string; email: string | null; verified: boolean } | null; profile: CreatorProfile | null; profileError?: string; recording?: RecordingPreferences | null; recordingError?: string };
export const PROFILE_COLUMNS = "account_id,handle,display_name,bio,location,creator_role,revision,created_at,updated_at";

/** Cookie-authenticated BFF only: never store tokens or real identity in demo localStorage. */
export async function accountRequest<T>(action?: AccountAction, handle?: string): Promise<T> {
  const response = await fetch(`/api/account${handle ? `?handle=${encodeURIComponent(handle)}` : ""}`, {
    method: action ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
    ...(action ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Account service unavailable.");
  return data as T;
}
