import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accountActionSchema, handleSchema, PROFILE_COLUMNS, RECORDING_COLUMNS } from "./account";

type AccountEnvironment = { url: string | undefined; key: string | undefined; siteUrl: string | undefined };
export type AccountClientFactory = (cookies: {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options: Parameters<typeof serializeCookieHeader>[2] }[]) => void;
}) => SupabaseClient;

/** One client per request. Never use the generated admin client or bypass RLS. */
export function accountEnvironment(): AccountEnvironment {
  return {
    url: process.env['SUPABASE_URL'] || import.meta.env['VITE_SUPABASE_URL'],
    key: process.env['SUPABASE_PUBLISHABLE_KEY'] || import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'],
    siteUrl: process.env['ARENA_SITE_URL'],
  };
}
function isPublicKey(key: string): boolean {
  if (key.startsWith("sb_publishable_")) return true;
  try { return JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "anon"; }
  catch { return false; }
}
function configuredOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ((url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) ? url.origin : null;
  } catch { return null; }
}

export async function handleAccountRequest(request: Request, env = accountEnvironment(), factory?: AccountClientFactory): Promise<Response> {
  const headers = new Headers({ "Cache-Control": "private, no-store", "Pragma": "no-cache", "Vary": "Cookie", "Referrer-Policy": "no-referrer" });
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers });
  const url = new URL(request.url);
  if (!configuredOrigin(url.origin)) return respond({ error: "HTTPS is required outside local development." }, 400);
  if (!["GET", "POST"].includes(request.method)) return respond({ error: "Method not allowed." }, 405);
  // No cross-origin mutations, including login CSRF. No wildcard preview origins.
  if (request.method === "POST" && (request.headers.get("origin") !== url.origin || !request.headers.get("content-type")?.startsWith("application/json"))) {
    return respond({ error: "Same-origin JSON requests are required." }, 403);
  }
  if (!env.url || !env.key || !isPublicKey(env.key)) return respond({ error: "Supabase public URL/publishable key configuration is missing or invalid." }, 503);
  const secure = url.protocol === "https:";
  const cookies = new Map(parseCookieHeader(request.headers.get("cookie") ?? "").flatMap(({ name, value }) => value === undefined ? [] : [[name, value] as const]));
  const cookieAdapter = {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll: (batch: { name: string; value: string; options: Parameters<typeof serializeCookieHeader>[2] }[]) => {
      for (const { name, value, options } of batch) {
        cookies.set(name, value);
        headers.append("Set-Cookie", serializeCookieHeader(name, value, { ...options, httpOnly: true, secure, sameSite: "lax", path: "/" }));
      }
    },
  };
  try {
    const client = factory ? factory(cookieAdapter) : createServerClient(env.url, env.key, {
      cookies: cookieAdapter,
      cookieOptions: { httpOnly: true, secure, sameSite: "lax", path: "/" },
    });
    if (request.method === "GET") {
      if (url.searchParams.has("handle")) {
        const handle = handleSchema.safeParse(url.searchParams.get("handle"));
        if (!handle.success) return respond({ error: "Profile not found." }, 404);
        const { data, error } = await client.from("creator_profiles").select(PROFILE_COLUMNS).eq("handle", handle.data).maybeSingle();
        if (error) return respond({ error: "Profiles are unavailable. The reviewed profile migration must be applied before use." }, 503);
        return data ? respond({ profile: data }) : respond({ error: "Profile not found." }, 404);
      }
      // getUser validates with Auth, unlike trusting user data from cookie/getSession.
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) {
        if (error && error.name !== "AuthSessionMissingError" && !(error.name === "AuthApiError" && [400, 401, 403].includes(error.status ?? 0))) return respond({ error: "Could not verify your session. Try again." }, 503);
        return respond({ user: null, profile: null });
      }
      const { data, error: profileError } = await client.from("creator_profiles").select(PROFILE_COLUMNS).eq("account_id", user.id).maybeSingle();
      const preferences = !profileError && data ? await client.from("creator_recording_preferences").select(RECORDING_COLUMNS).eq("account_id", user.id).maybeSingle() : null;
      return respond({ user: { id: user.id, email: user.email ?? null, verified: !!user.email_confirmed_at && !user.is_anonymous }, profile: data,
        recording: preferences?.error ? null : preferences?.data ?? null,
        ...(preferences?.error ? { recordingError: "Recording preferences are unavailable. Reload after the reviewed migration is applied." } : {}),
        ...(profileError ? { profileError: "Profiles are unavailable. The reviewed migration must be applied before use." } : {}) });
    }
    // Bound request parsing. Do not log request bodies, passwords, tokens or provider errors.
    const reader = request.body?.getReader();
    const parts: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 16_384) { await reader.cancel(); return respond({ error: "Request too large." }, 413); }
        parts.push(value);
      }
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { body.set(part, offset); offset += part.length; }
    const text = new TextDecoder().decode(body);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return respond({ error: "Invalid request." }, 400); }
    const parsed = accountActionSchema.safeParse(raw);
    if (!parsed.success) return respond({ error: "Invalid account fields. Check lengths, handle, role and password requirements." }, 400);
    const input = parsed.data;
    if (input.action === "signup" || input.action === "recover" || input.action === "resend") {
      const origin = configuredOrigin(env.siteUrl);
      if (!origin || origin !== url.origin) return respond({ error: "Configure ARENA_SITE_URL to this app's exact origin and approve its Supabase redirect URLs before sending email." }, 503);
      const callback = `${origin}/account`;
      const result = input.action === "signup"
        ? await client.auth.signUp({ email: input.email, password: input.password, options: { emailRedirectTo: callback } })
        : input.action === "recover" ? await client.auth.resetPasswordForEmail(input.email, { redirectTo: `${callback}?recovery=1` })
        : await client.auth.resend({ type: "signup", email: input.email, options: { emailRedirectTo: callback } });
      if (result.error) return respond({ error: "Email request could not be completed. Try again later." }, 400);
      return respond({ message: "If eligible, check your email for the next step. Verification is required before creating a profile." });
    }
    if (input.action === "signin") {
      const { data, error } = await client.auth.signInWithPassword({ email: input.email, password: input.password });
      if (error || !data.user) return respond({ error: "Sign-in failed. Check your credentials and verify your email." }, 401);
      return respond({ message: "Signed in." });
    }
    if (input.action === "exchange") {
      const { error } = await client.auth.exchangeCodeForSession(input.code);
      return error ? respond({ error: "This link is expired, already used, or was opened in a different browser. Request a new link in this browser." }, 400) : respond({ message: "Email link confirmed." });
    }
    if (input.action === "signout") {
      const { error } = await client.auth.signOut({ scope: "local" });
      return error ? respond({ error: "Could not sign out. Try again." }, 503) : respond({ message: "Signed out." });
    }
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return respond({ error: "Sign in to continue." }, 401);
    if (input.accountId !== user.id) return respond({ error: "Your signed-in account changed. Reload before continuing." }, 409);
    if (!user.email_confirmed_at || user.is_anonymous) return respond({ error: "Verify your email before continuing." }, 403);
    if (input.action === "password") {
      const { error } = await client.auth.updateUser({ password: input.password });
      return error ? respond({ error: "Password could not be updated. Request a new recovery link or sign in again." }, 400) : respond({ message: "Password updated." });
    }
    if (input.action === "recording") {
      const { revision, ...fields } = input.preferences;
      const query = client.from("creator_recording_preferences");
      const result = revision === null
        ? await query.insert({ ...fields, account_id: user.id }).select(RECORDING_COLUMNS).single()
        : await query.update(fields).eq("account_id", user.id).eq("revision", revision).select(RECORDING_COLUMNS).maybeSingle();
      if (result.error) return respond({ error: result.error.code === "23505" ? "Recording preferences changed elsewhere. Reload before saving again." : "Could not save recording preferences. Confirm the migration is applied and try again." }, result.error.code === "23505" ? 409 : 400);
      if (!result.data) return respond({ error: "Recording preferences changed elsewhere. Reload before saving again." }, 409);
      return respond({ recording: result.data });
    }
    const query = client.from("creator_profiles");
    const result = input.action === "create-profile"
      ? await query.insert({ ...input.profile, account_id: user.id }).select(PROFILE_COLUMNS).single()
      : await query.update(input.action === "role" ? { creator_role: input.profile.creator_role } : {
        display_name: input.profile.display_name, bio: input.profile.bio, location: input.profile.location,
      }).eq("account_id", user.id).eq("revision", input.profile.revision).select(PROFILE_COLUMNS).maybeSingle();
    if (result.error) return respond({ error: result.error.code === "23505" ? "That handle or account already has a profile. Reload or choose another handle." : "Could not save profile. Confirm the migration is applied and try again." }, result.error.code === "23505" ? 409 : 400);
    if (!result.data) return respond({ error: "Profile changed elsewhere. Reload before saving again." }, 409);
    return respond({ profile: result.data });
  } catch {
    return respond({ error: "Account service unavailable. Your demo data has not been changed." }, 503);
  }
}
