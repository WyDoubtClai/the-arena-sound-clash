import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { accountRequest, profileCreateSchema, creatorRoleSchema, accountRoleLabel, accountChallengeRole, RECORDING_SETUPS, RECORDING_CAPABILITIES, recordingSchema, type RecordingPreferences, type AccountAction, type AccountState, type CreatorProfile } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "./bits";

function RecordingFields({ value }: { value?: RecordingPreferences | null }) {
  return <div className="space-y-4">
    <label className="block">Recording setup<select name="recording_setup" defaultValue={value?.recording_setup ?? ""} className={fieldClass}><option value="">Not specified (optional)</option>{RECORDING_SETUPS.map((option) => <option key={option}>{option}</option>)}</select></label>
    <label className="block">Can you record and export music within 15 minutes?<select name="can_record_15m" defaultValue={value?.can_record_15m ?? ""} className={fieldClass}><option value="">Not specified (optional)</option>{RECORDING_CAPABILITIES.map((option) => <option key={option}>{option}</option>)}</select></label>
    <p className="text-xs text-muted-foreground">Private, optional preferences. These do not restrict competition eligibility.</p>
  </div>;
}
const fieldClass = "w-full rounded-lg border bg-background p-3 text-sm";
function RoleFields({ value }: { value?: string }) {
  return <fieldset className="space-y-2"><legend className="mb-2 font-semibold">Creator role</legend>{creatorRoleSchema.options.map((role) => <label key={role} className="mr-4 inline-flex items-center gap-2"><input type="radio" name="creator_role" value={role} defaultChecked={value === role} required />{role}</label>)}</fieldset>;
}
function ProfileFields({ profile }: { profile?: CreatorProfile }) {
  return <>
    {!profile && <label className="block">Handle<input name="handle" required minLength={3} maxLength={30} pattern="[a-z][a-z0-9_]{2,29}" autoCapitalize="none" autoComplete="username" className={fieldClass} /><span className="text-xs text-muted-foreground">3–30 lowercase letters, numbers or underscores; starts with a letter. Permanent after creation.</span></label>}
    <label className="block">Display name<input name="display_name" required maxLength={80} defaultValue={profile?.display_name} className={fieldClass} /></label>
    <label className="block">Bio<textarea name="bio" maxLength={500} defaultValue={profile?.bio ?? ""} className={fieldClass} /></label>
    <label className="block">Location (optional)<input name="location" maxLength={100} defaultValue={profile?.location ?? ""} className={fieldClass} /></label>
  </>;
}
export function PublicCreator({ profile }: { profile: CreatorProfile }) {
  return <Panel className="space-y-3 rounded-lg"><h1 className="font-display text-2xl font-bold">{profile.display_name}</h1>
    <p className="text-muted-foreground">@{profile.handle}</p><p className="text-violet">{accountRoleLabel(profile.creator_role)}</p>
    {profile.bio && <p className="whitespace-pre-wrap break-words">{profile.bio}</p>}{profile.location && <p>{profile.location}</p>}
    <p className="text-sm text-muted-foreground">Real creator profile. No demo songs, XP, awards or battle history belong to this account. Music uploads are not required to have a profile.</p>
  </Panel>;
}

export function AccountPage() {
  const [state, setState] = useState<AccountState | null>(null);
  const [mode, setMode] = useState<"signin" | "signup" | "recover" | "resend" | "password">("signin");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [settings, setSettings] = useState(false);
  const [edit, setEdit] = useState(false);
  const started = useRef(false);
  const operation = useRef(false);
  const generation = useRef(0);
  const currentAccount = useRef<string | null>(null);
  const load = async () => {
    const current = ++generation.current;
    const next = await accountRequest<AccountState>();
    if (current === generation.current) {
      if (currentAccount.current !== (next.user?.id ?? null)) {
        setMode("signin"); setSettings(false); setEdit(false);
      }
      currentAccount.current = next.user?.id ?? null;
      setState(next);
    }
  };
  const run = async (action: AccountAction) => {
    if (operation.current) return;
    operation.current = true; ++generation.current; setBusy(true); setError(""); setMessage("");
    try {
      const response = await accountRequest<{ message?: string }>(action);
      setMessage(response.message ?? "Saved.");
      // Email requests may have no session, and do not need the profile table yet.
      if (!["signup", "recover", "resend", "signout"].includes(action.action)) await load();
      if (action.action === "signout") { currentAccount.current = null; setState({ user: null, profile: null }); setMode("signin"); }
      if (action.action === "password") setMode("signin");
      setSettings(false); setEdit(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed. Try again."); }
    finally { operation.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const boot = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const recovery = url.searchParams.get("recovery") === "1";
      const linkError = url.searchParams.has("error") || url.hash.includes("error=");
      // Strip one-time secrets/errors before any subsequent navigation. Never render provider error strings.
      window.history.replaceState({}, "", url.pathname);
      try {
        if (linkError) throw new Error("Email link failed or expired. Request a new link.");
        if (code) await accountRequest({ action: "exchange", code });
        await load();
        if (code && recovery) setMode("password");
      } catch (e) { setError(e instanceof Error ? e.message : "Could not load your account."); }
      finally { setBusy(false); }
    };
    void boot();
  }, []);
  // Other tabs revalidate their cookie session; no cached account may write as a different account.
  useEffect(() => {
    const refresh = () => { if (!operation.current) { setSettings(false); setEdit(false); void load().catch(() => { setState(null); setError("Session could not be refreshed. Reload before continuing."); }); } };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const user = state?.user;
  const profile = state?.profile;
  function credentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? ""), password = String(data.get("password") ?? "");
    if (mode === "password") { if (state?.user) void run({ action: "password", accountId: state.user.id, password }); else setError("Open a new recovery link or sign in first."); }
    else if (mode === "recover" || mode === "resend") void run({ action: mode, email });
    else void run({ action: mode, email, password });
  }
  return <div className="mx-auto max-w-xl space-y-5">
    <h1 className="font-display text-3xl font-bold">Arena Account</h1>
    <p className="text-sm text-muted-foreground">Your real account is separate from all fictional demos. XP and rewards remain disabled.</p>
    {error && <p role="alert" className="rounded-lg border border-coral p-3 text-coral">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-teal p-3 text-teal">{message}</p>}
    {busy && <p role="status">Working…</p>}
    {!busy && !state && <Button variant="outline" onClick={() => { setBusy(true); setError(""); void load().catch((e: Error) => setError(e.message)).finally(() => setBusy(false)); }}>Retry account connection</Button>}
    {(!user || mode === "password") && <Panel className="space-y-4 rounded-lg">
      <h2 className="font-display text-xl">{mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "password" ? "Set new password" : mode === "resend" ? "Resend verification" : "Recover password"}</h2>
      <form key={`${mode}:${user?.id ?? "anonymous"}`} onSubmit={credentials} className="space-y-4">
        {mode !== "password" && <label className="block">Email<input type="email" name="email" autoComplete="email" required maxLength={254} className={fieldClass} /></label>}
        {!["recover", "resend"].includes(mode) && <label className="block">Password<input type="password" name="password" required minLength={mode === "signin" ? 1 : 12} maxLength={128} autoComplete={mode === "signin" ? "current-password" : "new-password"} className={fieldClass} />{mode !== "signin" && <span className="text-xs">At least 12 characters.</span>}</label>}
        <Button disabled={busy} type="submit">{mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "password" ? "Update password" : "Send email"}</Button>
      </form>
      <div className="flex flex-wrap gap-2">{(["signin", "signup", "recover", "resend"] as const).filter((m) => m !== mode).map((m) => <Button key={m} variant="link" disabled={busy} onClick={() => { setMode(m); setError(""); setMessage(""); }}>{({ signin: "Sign in", signup: "Register", recover: "Forgot password?", resend: "Resend verification" })[m]}</Button>)}</div>
      <p className="text-xs text-muted-foreground">Open verification and recovery links in the same browser where you requested them.</p>
    </Panel>}
    {user && <>
      {state.profileError && <p role="alert" className="text-coral">{state.profileError}</p>}
      <p className="text-sm">Signed in as {user.email}</p>
      <Button disabled={busy} variant="outline" onClick={() => void run({ action: "signout" })}>Sign out</Button>
      {!user.verified ? <p role="alert">Verify your email before creating or editing a profile.</p> : state.profileError ? null : !profile ? <Panel className="rounded-lg">
        <h2 className="mb-3 font-display text-xl">Create your creator profile</h2>
        <p className="mb-4 text-sm text-muted-foreground">Choose your role explicitly. Demo settings, music and rewards are not imported.</p>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget));
          const parsed = profileCreateSchema.safeParse(data);
          if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
          void run({ action: "create-profile", accountId: user.id, profile: parsed.data });
        }}><ProfileFields /><RoleFields /><Button type="submit" disabled={busy}>Create profile</Button></form>
      </Panel> : <>
        <PublicCreator profile={profile} />
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => setEdit(true)}>Edit profile</Button><Button variant="outline" disabled={busy} onClick={() => setSettings(true)}>Settings</Button><Link to="/creators/$handle" params={{ handle: profile.handle }} className="p-2 text-violet">Public profile →</Link></div>
        <Dialog open={edit || settings} onOpenChange={(open) => { if (!open && !busy) { setEdit(false); setSettings(false); } }}>
          <DialogContent className="max-h-[90svh] overflow-y-auto bg-surface"><DialogHeader><DialogTitle>{settings ? "Account Settings" : "Edit profile"}</DialogTitle><DialogDescription>{settings ? "Role changes apply to future daily assignments only. Existing assignments stay unchanged; challenge XP remains dormant. Reset: 00:00 UTC." : "Update your public profile. Change your role through Settings."}</DialogDescription></DialogHeader>
            {error && <p role="alert" className="text-coral">{error}</p>}
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault(); const data = new FormData(e.currentTarget);
              if (settings) {
                const role = String(data.get("creator_role"));
                const parsed = profileCreateSchema.shape.creator_role.safeParse(role);
                if (parsed.success) void run({ action: "role", accountId: user.id, profile: { creator_role: parsed.data, revision: profile.revision } });
              } else void run({ action: "edit-profile", accountId: user.id, profile: { display_name: String(data.get("display_name")), bio: String(data.get("bio")), location: String(data.get("location")), revision: profile.revision } });
            }}>
              {settings ? <><RoleFields value={profile.creator_role} /><p className="text-xs text-muted-foreground">Challenge eligibility: {accountChallengeRole(profile.creator_role) ?? "Fan challenges are not implemented"}. Both means three challenges, not six.</p></> : <ProfileFields profile={profile} />}
              <div className="flex gap-2"><Button type="submit" disabled={busy}>Save</Button><Button variant="outline" type="button" disabled={busy} onClick={() => { setEdit(false); setSettings(false); }}>Cancel</Button></div>
            </form>
            {settings && profile.creator_role !== "Fan" && <section className="mt-4 space-y-3 border-t pt-4">
              <h3 className="font-semibold">Recording preferences</h3>
              {state.recordingError ? <p role="alert" className="text-coral">{state.recordingError}</p> : <form className="space-y-3" onSubmit={(e) => {
                e.preventDefault(); const data = new FormData(e.currentTarget);
                const preferences = recordingSchema.parse({ recording_setup: data.get("recording_setup") || null, can_record_15m: data.get("can_record_15m") || null, revision: state.recording?.revision ?? null });
                void run({ action: "recording", accountId: user.id, preferences });
              }}><RecordingFields value={state.recording ?? null} /><Button type="submit" disabled={busy}>Save recording preferences</Button></form>}
            </section>}
            {settings && profile.creator_role === "Fan" && <p className="text-sm text-muted-foreground">Fans do not need recording setup or music uploads. Any previous recording preferences remain private.</p>}
          </DialogContent>
        </Dialog>
      </>}
    </>}
    <p className="text-sm"><Link to="/profile" className="text-violet">Explore fictional demo profiles →</Link></p>
  </div>;
}
