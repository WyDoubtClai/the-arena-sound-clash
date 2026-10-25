import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
import { accountActionSchema, handleSchema, profileCreateSchema, accountChallengeRole, recordingSchema, PROFILE_COLUMNS } from "@/lib/account";
import { handleAccountRequest, type AccountClientFactory } from "@/lib/account.server";

const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const env = { url: "https://example.supabase.co", key: "sb_publishable_test", siteUrl: "https://arena.test" };
const profile = { handle: "new_creator", display_name: "Creator", bio: "", location: "", creator_role: "Both" as const };
const user = { id: A, email: "creator@example.test", email_confirmed_at: "2026-10-25T00:00:00Z", is_anonymous: false };
function harness() {
  let result: { data: unknown; error: { code: string } | null } = { data: { ...profile, account_id: A, revision: 0 }, error: null };
  const query: Record<string, any> = {};
  for (const name of ["select", "eq", "insert", "update"]) query[name] = vi.fn(() => query);
  query["maybeSingle"] = vi.fn(async () => result);
  query["single"] = vi.fn(async () => result);
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: user as typeof user | null }, error: null as { name: string; status?: number } | null })),
    signUp: vi.fn(async () => ({ data: {}, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user }, error: null as unknown })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    resend: vi.fn(async () => ({ error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ error: null as unknown })),
    updateUser: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null as unknown })),
  };
  const client = { auth, from: vi.fn(() => query) };
  let adapter: Parameters<AccountClientFactory>[0];
  const factory: AccountClientFactory = (cookies) => { adapter = cookies; return client as any; };
  const request = (data?: unknown, options: { method?: string; origin?: string; type?: string; path?: string; cookie?: string } = {}) => {
    const method = options.method ?? (data === undefined ? "GET" : "POST");
    return new Request(`https://arena.test/api/account${options.path ?? ""}`, { method, headers: { origin: options.origin ?? "https://arena.test", "content-type": options.type ?? "application/json", cookie: options.cookie ?? "" }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  };
  const call = (data?: unknown, options?: Parameters<typeof request>[1]) => handleAccountRequest(request(data, options), env, factory);
  return { auth, query, client, factory, request, call, setResult: (value: typeof result) => { result = value; }, adapter: () => adapter! };
}
let h: ReturnType<typeof harness>;
beforeEach(() => { h = harness(); });

describe("account validation and role mapping", () => {
  it.each(["Rapper", "Producer", "Both", "Fan"] as const)("accepts exactly one %s role", (role) => {
    expect(profileCreateSchema.parse({ ...profile, creator_role: role }).creator_role).toBe(role);
    expect(accountChallengeRole(role)).toBe(role === "Fan" ? null : role === "Rapper" ? "Artist" : role);
  });
  it.each(["Artist", "Judge", "", null, ["Rapper", "Producer"]])("rejects invalid role %j", (creator_role) => {
    expect(profileCreateSchema.safeParse({ ...profile, creator_role }).success).toBe(false);
  });
  it.each(["blaze", "tonemadelt", "judgeraye", "admin", "ab", "bad-name", "1abc", "a".repeat(31)])("rejects reserved/invalid handle %s", (handle) => expect(handleSchema.safeParse(handle).success).toBe(false));
  it("normalizes handles and rejects impersonated owner fields or oversized text", () => {
    expect(handleSchema.parse(" New_Creator ")).toBe("new_creator");
    expect(profileCreateSchema.safeParse({ ...profile, account_id: B }).success).toBe(false);
    for (const fields of [{ bio: "a".repeat(501) }, { display_name: " " }, { location: "a".repeat(101) }]) expect(profileCreateSchema.safeParse({ ...profile, ...fields }).success).toBe(false);
  });
  it("rejects hidden role changes through profile edit and malformed revisions", () => {
    for (const revision of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(accountActionSchema.safeParse({ action: "role", accountId: A, profile: { creator_role: "Both", revision } }).success).toBe(false);
    expect(accountActionSchema.safeParse({ action: "edit-profile", accountId: A, profile: { display_name: "Name", bio: "", location: "", revision: 0, creator_role: "Both" } }).success).toBe(false);
  });
});

describe("request-scoped auth and CSRF boundary (mocked provider)", () => {
  it.each(["https://evil.test", "null", ""])("rejects mutation origin %s before any provider call", async (origin) => {
    expect((await h.call({ action: "signout" }, { origin })).status).toBe(403);
    expect(h.auth.signOut).not.toHaveBeenCalled();
  });
  it("rejects non-JSON, unknown actions, malformed JSON and unsupported methods", async () => {
    expect((await h.call({ action: "signout" }, { type: "text/plain" })).status).toBe(403);
    expect((await h.call({ action: "admin" })).status).toBe(400);
    expect((await h.call(undefined, { method: "DELETE" })).status).toBe(405);
    const bad = new Request("https://arena.test/api/account", { method: "POST", headers: { origin: "https://arena.test", "content-type": "application/json" }, body: "{" });
    expect((await handleAccountRequest(bad, env, h.factory)).status).toBe(400);
  });
  it("bounds request bodies before parsing", async () => {
    expect((await h.call({ action: "signout", padding: "x".repeat(17_000) })).status).toBe(413);
  });
  it("rejects a legacy service-role JWT even if configuration labels it public", async () => {
    const key = `prefix.${btoa(JSON.stringify({ role: "service_role" }))}.signature`;
    expect((await handleAccountRequest(h.request(), { ...env, key }, h.factory)).status).toBe(503);
  });
  it("rejects missing configuration and secret API keys", async () => {
    for (const value of [{ ...env, key: undefined }, { ...env, url: undefined }, { ...env, key: "sb_secret_not_allowed" }]) expect((await handleAccountRequest(h.request(), value, h.factory)).status).toBe(503);
    expect(h.auth.getUser).not.toHaveBeenCalled();
  });
  it("requires a configured matching origin before email delivery", async () => {
    for (const siteUrl of [undefined, "https://evil.test", "https://arena.test/path", "javascript:bad"]) {
      expect((await handleAccountRequest(h.request({ action: "recover", email: user.email }), { ...env, siteUrl }, h.factory)).status).toBe(503);
    }
    expect(h.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("prepares signup and verification without exposing provider session data", async () => {
    const response = await h.call({ action: "signup", email: user.email, password: "a long test password" });
    expect(response.status).toBe(200);
    expect(h.auth.signUp).toHaveBeenCalledWith({ email: user.email, password: "a long test password", options: { emailRedirectTo: "https://arena.test/account" } });
    expect(await response.text()).not.toMatch(/password|access_token|refresh_token/);
    expect(h.client.from).not.toHaveBeenCalled();
    await h.call({ action: "resend", email: user.email });
    expect(h.auth.resend).toHaveBeenCalledWith({ type: "signup", email: user.email, options: { emailRedirectTo: "https://arena.test/account" } });
  });
  it("requests recovery using only the fixed configured callback", async () => {
    await h.call({ action: "recover", email: user.email });
    expect(h.auth.resetPasswordForEmail).toHaveBeenCalledWith(user.email, { redirectTo: "https://arena.test/account?recovery=1" });
    expect((await h.call({ action: "recover", email: user.email, redirectTo: "https://evil.test" })).status).toBe(400);
  });
  it("exchanges the PKCE code, rejects reuse errors and sanitizes sign-in errors", async () => {
    expect((await h.call({ action: "exchange", code: "single-use-test-code" })).status).toBe(200);
    expect(h.auth.exchangeCodeForSession).toHaveBeenCalledWith("single-use-test-code");
    h.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("provider internal detail") });
    expect((await h.call({ action: "exchange", code: "used" })).status).toBe(400);
    h.auth.signInWithPassword.mockResolvedValueOnce({ data: { user }, error: new Error("credential details") });
    const response = await h.call({ action: "signin", email: user.email, password: "anything" });
    expect(response.status).toBe(401); expect(await response.text()).not.toContain("credential details");
  });
  it("writes HttpOnly secure host-scoped cookies and never caches account responses", async () => {
    h.auth.signInWithPassword.mockImplementationOnce(async () => {
      h.adapter().setAll([{ name: "sb-test", value: "test-session", options: { httpOnly: false, path: "/bad", sameSite: "none" } }]);
      return { data: { user }, error: null };
    });
    const response = await h.call({ action: "signin", email: user.email, password: "anything" }, { cookie: "existing=one" });
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(response.headers.get("set-cookie")).toMatch(/Secure/);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=Lax/);
    expect(response.headers.get("set-cookie")).toContain("Path=/;");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(h.adapter().getAll()).toContainEqual({ name: "existing", value: "one" });
  });
  it("validates sessions via getUser and exposes only minimal account fields", async () => {
    const response = await h.call();
    expect(await response.json()).toMatchObject({ user: { id: A, email: user.email, verified: true } });
    expect(h.auth.getUser).toHaveBeenCalledOnce();
    expect(h.query["eq"]).toHaveBeenCalledWith("account_id", A);
  });
  it("handles missing/expired sessions without demo fallback and distinguishes network failure", async () => {
    h.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
    expect(await (await h.call()).json()).toEqual({ user: null, profile: null });
    expect(h.client.from).not.toHaveBeenCalled();
    h.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { name: "AuthApiError", status: 500 } });
    expect((await h.call()).status).toBe(503);
  });
  it("allows signout even when the unapplied profile table is unavailable", async () => {
    h.setResult({ data: null, error: { code: "42P01" } });
    const state = await (await h.call()).json();
    expect(state.user.id).toBe(A); expect(state.profileError).toContain("migration");
    expect((await h.call({ action: "signout" })).status).toBe(200);
    expect(h.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("keeps request clients and cookies isolated", async () => {
    await h.call(undefined, { cookie: "account=A" }); const first = h.adapter();
    await h.call(undefined, { cookie: "account=B" }); const second = h.adapter();
    expect(first).not.toBe(second);
    expect(first.getAll()).toEqual([{ name: "account", value: "A" }]);
    expect(second.getAll()).toEqual([{ name: "account", value: "B" }]);
  });
});

describe("profile ownership and persistence adapter (mocked database)", () => {
  it("derives creation ownership from the verified user, not the demo profile or payload", async () => {
    expect((await h.call({ action: "create-profile", accountId: A, profile })).status).toBe(200);
    expect(h.query["insert"]).toHaveBeenCalledWith({ ...profile, account_id: A });
    expect((await h.call({ action: "create-profile", accountId: A, profile: { ...profile, account_id: B } })).status).toBe(400);
  });
  it.each([null, { ...user, email_confirmed_at: "" }, { ...user, is_anonymous: true }])("rejects unauthenticated/unverified/anonymous writes %j", async (value) => {
    h.auth.getUser.mockResolvedValueOnce({ data: { user: value }, error: null });
    expect([401, 403]).toContain((await h.call({ action: "create-profile", accountId: A, profile })).status);
    expect(h.client.from).not.toHaveBeenCalled();
  });
  it("rejects stale account switching before mutation", async () => {
    expect((await h.call({ action: "role", accountId: B, profile: { creator_role: "Producer", revision: 0 } })).status).toBe(409);
    expect(h.query["update"]).not.toHaveBeenCalled();
    expect((await h.call({ action: "password", accountId: B, password: "new long password" })).status).toBe(409);
    expect(h.auth.updateUser).not.toHaveBeenCalled();
  });
  it("updates role only under the current owner's revision without changing daily records", async () => {
    expect((await h.call({ action: "role", accountId: A, profile: { creator_role: "Rapper", revision: 2 } })).status).toBe(200);
    expect(h.query["update"]).toHaveBeenCalledWith({ creator_role: "Rapper" });
    expect(h.query["eq"].mock.calls).toEqual([["account_id", A], ["revision", 2]]);
    expect(h.client.from).toHaveBeenCalledWith("creator_profiles");
  });
  it("returns conflicts for stale updates and duplicate handles/account creation", async () => {
    h.setResult({ data: null, error: null });
    expect((await h.call({ action: "role", accountId: A, profile: { creator_role: "Both", revision: 0 } })).status).toBe(409);
    h.setResult({ data: null, error: { code: "23505" } });
    expect((await h.call({ action: "create-profile", accountId: A, profile })).status).toBe(409);
  });
  it("public reads contain only public profile columns and never need a login", async () => {
    const response = await h.call(undefined, { path: "?handle=new_creator" });
    expect(response.status).toBe(200); expect(h.auth.getUser).not.toHaveBeenCalled();
    const columns = h.query["select"].mock.calls[0][0];
    expect(columns).not.toMatch(/email|password|token/);
    expect(h.query["eq"]).toHaveBeenCalledWith("handle", "new_creator");
    expect((await h.call(undefined, { path: "?handle=blaze" })).status).toBe(404);
  });
  it("changes password only for the verified current account", async () => {
    expect((await h.call({ action: "password", accountId: A, password: "new long password" })).status).toBe(200);
    expect(h.auth.updateUser).toHaveBeenCalledWith({ password: "new long password" });
  });
});

describe("migration source contracts — not execution or proof of RLS", () => {
  const sql = readFileSync("supabase/migrations/20261025060000_creator_profiles.sql", "utf8");
  it("defines durable owner identity, unique handles and bounded role/profile data", () => {
    expect(sql).toContain("account_id uuid primary key references auth.users(id)");
    expect(sql).toContain("handle text not null unique");
    expect(sql).toContain("creator_role in ('Rapper','Producer','Both','Fan')");
    expect(sql).toContain("char_length(bio) <= 500");
  });
  it("enables RLS, explicit limited column grants and owner checks", () => {
    expect(sql).toContain("enable row level security"); expect(sql).toContain("revoke all on public.creator_profiles from public, anon, authenticated");
    expect(sql).toContain("(select auth.uid()) = account_id");
    expect(sql).toContain("grant update (display_name, bio, location, creator_role)");
    expect(sql).not.toMatch(/grant (?:all|delete)/i);
  });
  it("reads confirmation from protected Auth data and enforces immutable identity/server revisions", () => {
    expect(sql).toContain("from auth.users where id = (select auth.uid()) and email_confirmed_at is not null");
    expect(sql).not.toContain("auth.jwt()");
    expect(sql).toContain("new.handle is distinct from old.handle");
    expect(sql).toContain("new.revision := old.revision + 1");
  });
});


describe("real Supabase SSR SDK with mocked HTTP only", () => {
  it("persists PKCE in HttpOnly cookies, exchanges once and never returns tokens", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/signup")) return Response.json({ ...user, email_confirmed_at: null });
      if (url.includes("/token")) return Response.json({ access_token: "test-access-token", refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600, user });
      return Response.json({ message: "Unexpected mocked URL" }, { status: 400 });
    });
    const factory: AccountClientFactory = (cookies) => createServerClient(env.url, env.key, { cookies, global: { fetch: fetcher } });
    const signup = await handleAccountRequest(h.request({ action: "signup", email: user.email, password: "a long test password" }), env, factory);
    expect(signup.status).toBe(200);
    const verifier = signup.headers.getSetCookie();
    expect(verifier.some((cookie) => cookie.includes("code-verifier=") && cookie.includes("HttpOnly"))).toBe(true);
    const cookie = verifier.map((value) => value.split(";")[0]).join("; ");
    const exchange = await handleAccountRequest(h.request({ action: "exchange", code: "mocked-auth-code" }, { cookie }), env, factory);
    expect(exchange.status).toBe(200);
    expect(exchange.headers.getSetCookie().some((value) => value.includes("HttpOnly") && !value.includes("code-verifier="))).toBe(true);
    expect(await exchange.text()).not.toMatch(/test-access-token|test-refresh-token/);
    expect(fetcher.mock.calls.some(([input]) => String(input).includes("grant_type=pkce"))).toBe(true);
  });
});


describe("private recording preferences and Fan profiles", () => {
  it("creates a Fan profile with no music or recording requirements", async () => {
    expect((await h.call({ action: "create-profile", accountId: A, profile: { ...profile, creator_role: "Fan" } })).status).toBe(200);
    expect(h.query["insert"]).toHaveBeenCalledWith({ ...profile, creator_role: "Fan", account_id: A });
    expect(accountChallengeRole("Fan")).toBeNull();
  });
  it.each(["Home studio", "Phone/tablet/computer recording app", "External studio or limited access", null])("accepts optional setup %s", (recording_setup) => {
    expect(recordingSchema.safeParse({ recording_setup, can_record_15m: null, revision: null }).success).toBe(true);
  });
  it.each(["Yes", "Sometimes", "No", null])("accepts informational capability %s without eligibility changes", (can_record_15m) => {
    expect(recordingSchema.safeParse({ recording_setup: null, can_record_15m, revision: 0 }).success).toBe(true);
  });
  it("rejects malformed preferences and preference injection into public profile fields", async () => {
    for (const change of [{ recording_setup: "Other" }, { can_record_15m: true }, { revision: -1 }, { account_id: B }]) {
      expect(recordingSchema.safeParse({ recording_setup: null, can_record_15m: null, revision: null, ...change }).success).toBe(false);
    }
    expect((await h.call({ action: "create-profile", accountId: A, profile: { ...profile, recording_setup: "Home studio" } })).status).toBe(400);
  });
  it("derives preference ownership from verified Auth and keeps fields off public reads", async () => {
    const preferences = { recording_setup: "Home studio", can_record_15m: "No", revision: null };
    expect((await h.call({ action: "recording", accountId: A, preferences })).status).toBe(200);
    expect(h.client.from).toHaveBeenCalledWith("creator_recording_preferences");
    expect(h.query["insert"]).toHaveBeenCalledWith({ account_id: A, recording_setup: "Home studio", can_record_15m: "No" });
    expect(PROFILE_COLUMNS).not.toMatch(/recording|can_record/);
    h.client.from.mockClear();
    await h.call(undefined, { path: "?handle=new_creator" });
    expect(h.client.from.mock.calls).toEqual([["creator_profiles"]]);
  });
  it("loads private preferences only for the verified current account and preserves read errors", async () => {
    const preferences = { recording_setup: "Home studio", can_record_15m: "Sometimes", revision: 1 };
    h.query["maybeSingle"].mockResolvedValueOnce({ data: { ...profile, account_id: A }, error: null }).mockResolvedValueOnce({ data: preferences, error: null });
    const response = await h.call();
    expect((await response.json()).recording).toEqual(preferences);
    expect(h.client.from.mock.calls).toEqual([["creator_profiles"], ["creator_recording_preferences"]]);
    expect(h.query["eq"].mock.calls).toEqual([["account_id", A], ["account_id", A]]);
    h.query["maybeSingle"].mockResolvedValueOnce({ data: { ...profile, account_id: A }, error: null }).mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(await (await h.call()).json()).toMatchObject({ recording: null, recordingError: expect.any(String) });
  });
  it("saves, clears and rejects stale preferences independently of profile revisions", async () => {
    expect((await h.call({ action: "recording", accountId: A, preferences: { recording_setup: null, can_record_15m: null, revision: 4 } })).status).toBe(200);
    expect(h.query["update"]).toHaveBeenCalledWith({ recording_setup: null, can_record_15m: null });
    expect(h.query["eq"].mock.calls).toEqual([["account_id", A], ["revision", 4]]);
    h.setResult({ data: null, error: null });
    expect((await h.call({ action: "recording", accountId: A, preferences: { recording_setup: null, can_record_15m: null, revision: 4 } })).status).toBe(409);
    h.setResult({ data: null, error: { code: "23505" } });
    expect((await h.call({ action: "recording", accountId: A, preferences: { recording_setup: null, can_record_15m: null, revision: null } })).status).toBe(409);
  });
  it("rejects another account and unverified preference writes", async () => {
    const preferences = { recording_setup: null, can_record_15m: null, revision: null };
    expect((await h.call({ action: "recording", accountId: B, preferences })).status).toBe(409);
    h.auth.getUser.mockResolvedValueOnce({ data: { user: { ...user, email_confirmed_at: "" } }, error: null });
    expect((await h.call({ action: "recording", accountId: A, preferences })).status).toBe(403);
    expect(h.query["insert"]).not.toHaveBeenCalled();
  });
  it("requires HTTPS for non-local account requests", async () => {
    const request = new Request("http://arena.test/api/account");
    expect((await handleAccountRequest(request, env, h.factory)).status).toBe(400);
    expect(h.auth.getUser).not.toHaveBeenCalled();
  });
  it("keeps private preference SQL owner-scoped with no anonymous read grant", () => {
    const sql = readFileSync("supabase/migrations/20261025060000_creator_profiles.sql", "utf8");
    expect(sql).toContain("alter table public.creator_recording_preferences enable row level security");
    expect(sql).toContain("grant select on public.creator_recording_preferences to authenticated;");
    expect(sql).not.toContain("grant select on public.creator_recording_preferences to anon");
    expect(sql).toContain("recording_owner_read");
    expect(sql).toContain("new.revision := old.revision + 1");
  });
});
