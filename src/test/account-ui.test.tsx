import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountPage, PublicCreator } from "@/components/arena/account-profile";
import { accountRequest } from "@/lib/account";

// Reproduce the stale bare-import bundle seen in Chrome after the Zod 3 -> 4 update.
// Account schemas must still load through the explicit v4 entry point.
vi.mock("zod", async () => import("zod/v3"));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children, to, ...props }: any) => <a href={to}>{children}</a> }));
vi.mock("@/lib/account", async (original) => ({ ...await original<typeof import("@/lib/account")>(), accountRequest: vi.fn() }));
const request = vi.mocked(accountRequest);
const id = "11111111-1111-4111-8111-111111111111";
const user = { id, email: "real@example.test", verified: true };
const profile = { account_id: id, handle: "real_creator", display_name: "Real Creator", bio: "Real bio", location: "", creator_role: "Both" as const, revision: 3, created_at: "2026-10-25T00:00Z", updated_at: "2026-10-25T00:00Z" };
beforeEach(() => { request.mockReset(); window.history.replaceState({}, "", "/account"); });
afterEach(cleanup);

describe("real account UI isolation and auth flow (mocked service)", () => {
  it.each([
    ["Register", "Create account", "signup", "Create account", "Email request could not be completed. Try again later."],
    ["Sign in", "Sign in", "signin", "Sign in", "Sign-in failed. Check your credentials and verify your email."],
    ["Forgot password?", "Recover password", "recover", "Send email", "Email request could not be completed. Try again later."],
    ["Resend verification", "Resend verification", "resend", "Send email", "Email request could not be completed. Try again later."],
  ])("keeps %s usable and renders service failures inline", async (navigation, heading, action, submit, message) => {
    request.mockResolvedValueOnce({ user: null, profile: null }).mockRejectedValueOnce(new Error(message));
    render(<AccountPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Register" })).toBeEnabled());
    if (action !== "signin") fireEvent.click(screen.getByRole("button", { name: navigation }));
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "browser-test@example.invalid" } });
    if (action === "signup" || action === "signin") fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "fake browser test password" } });
    fireEvent.click(screen.getByRole("button", { name: submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(request).toHaveBeenLastCalledWith({ action, email: "browser-test@example.invalid", ...(["signup", "signin"].includes(action) ? { password: "fake browser test password" } : {}) });
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: submit })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: action === "signin" ? "Register" : "Sign in" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText(/^Password/)).toHaveValue("");
  });
  it("does not auto-create a real profile or import a demo identity", async () => {
    request.mockResolvedValue({ user: null, profile: null });
    render(<AccountPage />);
    await screen.findByRole("heading", { name: "Sign in" });
    expect(request.mock.calls).toEqual([[]]);
    expect(screen.queryByText("Blaze")).not.toBeInTheDocument();
    expect(screen.queryByText("Beat Vault")).not.toBeInTheDocument();
  });
  it("offers email/password signup with explicit verification instructions", async () => {
    request.mockResolvedValueOnce({ user: null, profile: null }).mockResolvedValueOnce({ message: "Check your email." });
    render(<AccountPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Register" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "a long test password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByText("Check your email.");
    expect(request).toHaveBeenLastCalledWith({ action: "signup", email: user.email, password: "a long test password" });
  });
  it("exchanges a recovery code once, removes it from URL and permits new password", async () => {
    window.history.replaceState({}, "", "/account?code=one-time&recovery=1");
    request.mockResolvedValueOnce({ message: "Confirmed" }).mockResolvedValueOnce({ user, profile });
    render(<AccountPage />);
    await screen.findByRole("heading", { name: "Set new password" });
    expect(request.mock.calls[0]).toEqual([{ action: "exchange", code: "one-time" }]);
    expect(window.location.search).toBe("");
    expect(request.mock.calls.filter(([action]) => action?.action === "exchange")).toHaveLength(1);
  });
  it("does not echo malicious callback error text", async () => {
    window.history.replaceState({}, "", "/account?error=bad&error_description=private-secret");
    render(<AccountPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Email link failed or expired");
    expect(document.body.textContent).not.toContain("private-secret");
    expect(request).not.toHaveBeenCalled();
  });
  it("requires an explicit single role during onboarding", async () => {
    request.mockResolvedValueOnce({ user, profile: null });
    render(<AccountPage />);
    await screen.findByRole("heading", { name: "Create your creator profile" });
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getAllByRole("radio").every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(/Demo settings, music and rewards are not imported/)).toBeInTheDocument();
  });
  it("creates a profile for the current real account without demo data", async () => {
    request.mockResolvedValueOnce({ user, profile: null }).mockResolvedValueOnce({ profile }).mockResolvedValueOnce({ user, profile });
    render(<AccountPage />);
    await screen.findByRole("heading", { name: "Create your creator profile" });
    fireEvent.change(screen.getByLabelText(/^Handle/), { target: { value: "real_creator" } });
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Real Creator" } });
    fireEvent.click(screen.getByRole("radio", { name: "Both" }));
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
    await screen.findByRole("heading", { name: "Real Creator" });
    expect(request.mock.calls[1]).toEqual([{ action: "create-profile", accountId: id, profile: { handle: "real_creator", display_name: "Real Creator", bio: "", location: "", creator_role: "Both" } }]);
  });
  it("only Settings exposes subsequent role changes, and cancel discards drafts", async () => {
    request.mockResolvedValue({ user, profile });
    render(<AccountPage />); await screen.findByRole("heading", { name: "Real Creator" });
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("radio", { name: "Both" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Producer" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("radio", { name: "Both" })).toBeChecked();
    expect(request.mock.calls.every(([action]) => !action)).toBe(true);
  });
  it("saves role with stable account/revision and leaves XP dormant", async () => {
    request.mockResolvedValue({ user, profile });
    render(<AccountPage />); await screen.findByRole("heading", { name: "Real Creator" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("radio", { name: "Producer" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith({ action: "role", accountId: id, profile: { creator_role: "Producer", revision: 3 } }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText(/XP and rewards remain disabled/)).toBeInTheDocument();
  });
  it("shows persisted server data after remount without local profile state", async () => {
    request.mockResolvedValue({ user, profile });
    const view = render(<AccountPage />); await screen.findByRole("heading", { name: "Real Creator" });
    view.unmount(); render(<AccountPage />);
    await screen.findByRole("heading", { name: "Real Creator" });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("can sign out while the migration is pending", async () => {
    request.mockResolvedValueOnce({ user, profile: null, profileError: "Migration pending" }).mockResolvedValueOnce({ message: "Signed out." });
    render(<AccountPage />); await screen.findByText("Migration pending");
    expect(screen.queryByRole("button", { name: "Create profile" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("heading", { name: "Sign in" });
    expect(screen.queryByText(`Signed in as ${user.email}`)).not.toBeInTheDocument();
  });
  it("keeps visitor views read-only and excludes private/demo fields", () => {
    render(<PublicCreator profile={profile} />);
    expect(screen.getByText("Rapper & Producer")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(user.email);
    expect(document.body.textContent).not.toContain("Level 12");
  });
});


describe("Fan and private recording Settings", () => {
  it("lets Fans create public profiles without music or recording setup", async () => {
    request.mockResolvedValueOnce({ user, profile: null }).mockResolvedValueOnce({ profile: { ...profile, creator_role: "Fan" } }).mockResolvedValueOnce({ user, profile: { ...profile, creator_role: "Fan" } });
    render(<AccountPage />); await screen.findByRole("button", { name: "Create profile" });
    fireEvent.change(screen.getByLabelText(/^Handle/), { target: { value: "real_fan" } });
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Real Fan" } });
    fireEvent.click(screen.getByRole("radio", { name: "Fan" }));
    expect(screen.queryByLabelText("Recording setup")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith({ action: "create-profile", accountId: id, profile: { handle: "real_fan", display_name: "Real Fan", bio: "", location: "", creator_role: "Fan" } }));
  });
  it("Fans have Settings but no recording requirement or invented challenge mapping", async () => {
    request.mockResolvedValue({ user, profile: { ...profile, creator_role: "Fan" } });
    render(<AccountPage />); await screen.findByRole("button", { name: "Settings" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("radio", { name: "Fan" })).toBeChecked();
    expect(screen.queryByLabelText("Recording setup")).not.toBeInTheDocument();
    expect(screen.getByText(/Fan challenges are not implemented/)).toBeInTheDocument();
  });
  it.each(["Rapper", "Producer", "Both"])("stores optional private preferences for %s through Settings", async (creator_role) => {
    request.mockResolvedValue({ user, profile: { ...profile, creator_role }, recording: { recording_setup: "Home studio", can_record_15m: "Sometimes", revision: 2 } });
    render(<AccountPage />); await screen.findByRole("button", { name: "Settings" });
    expect(screen.queryByLabelText("Recording setup")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText("Recording setup")).toHaveValue("Home studio");
    fireEvent.change(screen.getByLabelText("Can you record and export music within 15 minutes?"), { target: { value: "No" } });
    fireEvent.click(screen.getByRole("button", { name: "Save recording preferences" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith({ action: "recording", accountId: id, preferences: { recording_setup: "Home studio", can_record_15m: "No", revision: 2 } }));
  });
  it("can save unspecified preferences and keeps them off public profiles", async () => {
    request.mockResolvedValue({ user, profile, recording: null });
    const view = render(<AccountPage />); await screen.findByRole("button", { name: "Settings" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Save recording preferences" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith({ action: "recording", accountId: id, preferences: { recording_setup: null, can_record_15m: null, revision: null } }));
    view.unmount(); render(<PublicCreator profile={{ ...profile, creator_role: "Fan" }} />);
    expect(screen.getByText("Fan")).toBeInTheDocument();
    expect(screen.queryByLabelText("Recording setup")).not.toBeInTheDocument();
  });
  it("does not overwrite unknown preferences when loading fails", async () => {
    request.mockResolvedValue({ user, profile, recording: null, recordingError: "Preferences unavailable" });
    render(<AccountPage />); await screen.findByRole("button", { name: "Settings" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByText("Preferences unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save recording preferences" })).not.toBeInTheDocument();
  });
  it("clears the recovery form when focus reveals a different signed-in account", async () => {
    window.history.replaceState({}, "", "/account?code=one-time&recovery=1");
    request.mockResolvedValueOnce({ message: "Confirmed" }).mockResolvedValueOnce({ user, profile });
    render(<AccountPage />); await screen.findByRole("heading", { name: "Set new password" });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "password meant for first account" } });
    request.mockResolvedValueOnce({ user: { ...user, id: "22222222-2222-4222-8222-222222222222", email: "other@example.test" }, profile: null });
    fireEvent.focus(window);
    await screen.findByText("Signed in as other@example.test");
    expect(screen.queryByRole("heading", { name: "Set new password" })).not.toBeInTheDocument();
    expect(request.mock.calls.some(([action]) => action?.action === "password")).toBe(false);
  });
});
