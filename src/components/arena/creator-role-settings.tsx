import { useState } from "react";
import { CREATOR_ROLE_OPTIONS, creatorRoleLabel, isCreatorRole, saveCreatorRole, type CreatorRole } from "@/lib/creator-settings";
import { canEditProfile, type ProfileId } from "@/lib/profile-demo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CreatorRoleDisplay({ role, loaded }: { role: CreatorRole | null; loaded: boolean }) {
  return <span aria-label="Creator role" className="rounded-md border border-violet/40 bg-violet/15 px-2 py-1 text-xs font-semibold text-violet">
    {!loaded ? "Loading creator role…" : role ? creatorRoleLabel(role) : "Creator role not selected"}
  </span>;
}

/** Mounted only while open so unsaved changes are discarded on cancel/reopen. */
export function CreatorRoleSettings({ profileId, currentRole, onClose }: { profileId: ProfileId; currentRole: CreatorRole | null; onClose: () => void }) {
  const [selection, setSelection] = useState<CreatorRole | "">(currentRole ?? "");
  const [error, setError] = useState("");
  if (!canEditProfile(profileId)) return null;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90svh] overflow-y-auto bg-surface">
      <DialogHeader>
        <DialogTitle>{currentRole ? "Account Settings" : "Creator profile setup"}</DialogTitle>
        <DialogDescription>Demo-local Settings for Blaze. Your role is saved in this browser only. This does not create an authenticated account or publish a profile.</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (!isCreatorRole(selection)) { setError("Choose Rapper, Producer, or Both."); return; }
        const result = saveCreatorRole(profileId, selection);
        if (result === "saved") onClose();
        else setError(result === "storage-unavailable" ? "Could not save your role. Browser storage is unavailable; your saved role has not changed." : "Your role could not be saved.");
      }}>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">Creator role</legend>
          {CREATOR_ROLE_OPTIONS.map((role) => <label key={role} className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 text-sm">
            <input type="radio" name="creator-role" value={role} checked={selection === role} onChange={() => { setSelection(role); setError(""); }} className="accent-[var(--violet)]" />
            {role}
          </label>)}
        </fieldset>
        <p className="text-xs text-muted-foreground">After setup, change your role here in Settings. Existing music, battle records, ratings, XP and achievements stay unchanged.</p>
        <p className="text-xs text-muted-foreground">Your saved role will apply when the next daily challenge assignment is created. Today’s assigned challenges and progress stay unchanged. Daily reset: 00:00 UTC, not local midnight. Challenge XP remains policy-only.</p>
        {error && <p role="alert" className="text-sm text-coral">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!selection}>Save creator role</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
