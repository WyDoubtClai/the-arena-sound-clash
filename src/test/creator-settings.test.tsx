import type { ComponentType, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/profile";
import { challengeRole, creatorRoleLabel, creatorSettingsKey, dailyFromSavedCreatorRole, parseCreatorSettings, readCreatorSettings, saveCreatorRole, type CreatorRole } from "@/lib/creator-settings";
import { applyDailyActivity, prepareDailyChallengeXp } from "@/lib/daily-challenges";
import { createLocalXpLedger, localXpProgress, processLocalXpAward } from "@/lib/progression";
import { competitive, earnedAchievements, matchHistory, profileRoles } from "@/lib/profile-demo";
import { people } from "@/lib/data";

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/player", async (original) => ({
  ...(await original<typeof import("@/lib/player")>()),
  usePlayer: () => ({ track: null, time: 0, duration: 0, playing: false, isCurrent: () => false, play: vi.fn(), pause: vi.fn(), seek: vi.fn() }),
}));
vi.mock("@/lib/synth", () => ({ waveBars: () => [0.3, 0.7] }));

const Profile = Route.options.component as ComponentType;
const DAY = "2026-10-24", START = Date.parse(`${DAY}T00:00Z`);
let storage: Map<string, string>;
let storageMock: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };
beforeEach(() => {
  storage = new Map();
  storageMock = {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
    removeItem: vi.fn((key: string) => { storage.delete(key); }),
  };
  vi.stubGlobal("localStorage", storageMock);
  window.history.replaceState({}, "", "/profile");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function chooseAndSave(role: CreatorRole) {
  fireEvent.click(screen.getByRole("radio", { name: role }));
  fireEvent.click(screen.getByRole("button", { name: "Save creator role" }));
}

describe("demo creator role setup and Settings", () => {
  it.each(["Rapper", "Producer", "Both"] as const)("explicitly selects %s and displays it after a reload", (role) => {
    const view = render(<Profile />);
    expect(screen.getByLabelText("Creator role")).toHaveTextContent("Creator role not selected");
    fireEvent.click(screen.getByRole("button", { name: "Set up creator profile" }));
    const dialog = screen.getByRole("dialog", { name: "Creator profile setup" });
    expect(within(dialog).getByText(/browser only/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save creator role" })).toBeDisabled();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    chooseAndSave(role);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Creator role")).toHaveTextContent(creatorRoleLabel(role));
    expect(readCreatorSettings("blaze")?.creatorRole).toBe(role);
    view.unmount();
    render(<Profile />);
    expect(screen.getByLabelText("Creator role")).toHaveTextContent(creatorRoleLabel(role));
    expect(screen.queryByRole("button", { name: "Set up creator profile" })).not.toBeInTheDocument();
  });

  it("reads the saved role, discards unsaved drafts, and changes it only through Settings", () => {
    saveCreatorRole("blaze", "Rapper");
    render(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("radio", { name: "Rapper" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Producer" }));
    expect(readCreatorSettings("blaze")?.creatorRole).toBe("Rapper");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("radio", { name: "Rapper" })).toBeChecked();
    expect(screen.getByText(/00:00 UTC, not local midnight/)).toBeInTheDocument();
    chooseAndSave("Both");
    expect(screen.getByLabelText("Creator role")).toHaveTextContent("Rapper & Producer");
    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("keeps role editing out of visitor previews and preserves their existing badges", () => {
    saveCreatorRole("blaze", "Both");
    render(<Profile />);
    fireEvent.click(screen.getByRole("tab", { name: "View ToneMadelt" }));
    expect(screen.getByText("Visitor preview")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up creator profile" })).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Profile identity")).getByText("Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Rapper & Producer")).not.toBeInTheDocument();
    expect(saveCreatorRole("tonemadelt", "Rapper")).toBe("forbidden");
    expect(saveCreatorRole("judgeraye", "Both")).toBe("forbidden");
    expect(storage.has(creatorSettingsKey("tonemadelt"))).toBe(false);
    fireEvent.click(screen.getByRole("tab", { name: "View Blaze" }));
    expect(screen.getByLabelText("Creator role")).toHaveTextContent("Rapper & Producer");
  });

  it("preserves all statistics, music, achievements and existing profile fixtures", () => {
    const fixtures = JSON.stringify({ people, competitive, earnedAchievements, matchHistory, profileRoles });
    render(<Profile />);
    const statistics = screen.getByLabelText("Demo profile statistics").textContent;
    const songs = screen.getByRole("region", { name: "Songs" }).textContent;
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    chooseAndSave("Producer");
    expect(screen.getByLabelText("Demo profile statistics").textContent).toBe(statistics);
    expect(screen.getByRole("region", { name: "Songs" }).textContent).toBe(songs);
    expect(JSON.stringify({ people, competitive, earnedAchievements, matchHistory, profileRoles })).toBe(fixtures);
    expect([...storage.keys()]).toEqual([creatorSettingsKey("blaze")]);
  });

  it("shows save failure honestly and leaves the previously saved role untouched", () => {
    saveCreatorRole("blaze", "Rapper");
    render(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    storageMock.setItem.mockImplementation(() => { throw new Error("quota"); });
    chooseAndSave("Producer");
    expect(screen.getByRole("alert")).toHaveTextContent("saved role has not changed");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(readCreatorSettings("blaze")?.creatorRole).toBe("Rapper");
  });

  it("handles unavailable storage without inventing a role", () => {
    storageMock.getItem.mockImplementation(() => { throw new Error("blocked"); });
    render(<Profile />);
    expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.getByLabelText("Creator role")).toHaveTextContent("not selected");
  });

  it("refreshes displayed saved data on storage synchronization", () => {
    saveCreatorRole("blaze", "Rapper");
    render(<Profile />);
    storage.set(creatorSettingsKey("blaze"), JSON.stringify({ version: 1, accountId: "blaze", creatorRole: "Both" }));
    act(() => { window.dispatchEvent(new Event("storage")); });
    expect(screen.getByLabelText("Creator role")).toHaveTextContent("Rapper & Producer");
  });
});

describe("saved role validation and daily policy adapter", () => {
  it.each([null, "Artist", "rapper", "Engineer", "", 1, {}, ["Rapper", "Producer"]])("rejects invalid selection %j without changing saved settings", (value) => {
    saveCreatorRole("blaze", "Both");
    expect(saveCreatorRole("blaze", value)).toBe("invalid");
    expect(readCreatorSettings("blaze")?.creatorRole).toBe("Both");
  });

  it.each([null, "{bad", "[]", '{"version":2,"accountId":"blaze","creatorRole":"Rapper"}', '{"version":1,"accountId":"tonemadelt","creatorRole":"Rapper"}', '{"version":1,"accountId":"blaze","creatorRole":"Artist"}'])("does not infer a saved role from malformed/legacy data %s", (text) => {
    expect(parseCreatorSettings(text, "blaze")).toBeNull();
  });

  it.each([["Rapper", "Artist"], ["Producer", "Producer"], ["Both", "Both"]] as const)("uses saved %s as %s with exactly three challenges", (role, internal) => {
    expect(challengeRole(role)).toBe(internal);
    expect(dailyFromSavedCreatorRole("blaze", DAY, null)).toBeNull();
    saveCreatorRole("blaze", role);
    const daily = dailyFromSavedCreatorRole("blaze", DAY, null)!;
    expect(daily.roleAtAssignment).toBe(internal);
    expect(daily.challengeIds).toHaveLength(3);
  });

  it("preserves same-day progress across role changes/reload; new days use the new saved role", () => {
    saveCreatorRole("blaze", "Rapper");
    const first = dailyFromSavedCreatorRole("blaze", DAY, null)!;
    const result = applyDailyActivity(first, { type: "battle-completed", accountId: "blaze", eventId: "verified:1", battleId: "real:1", occurredAt: START + 1000,
      verified: true, demo: false, battleRole: "Artist", validCompletion: true, eligibleBattle: true, simulatedParticipants: false }, START + 2000);
    expect(result.status).toBe("accepted");
    const awards = prepareDailyChallengeXp(result.record, createLocalXpLedger("blaze"), START + 2000);
    if (awards.status !== "prepared") throw new Error(awards.status);
    let ledger = createLocalXpLedger("blaze");
    for (const award of awards.awards) ledger = processLocalXpAward(ledger, award).ledger;
    expect(localXpProgress(ledger).lifetimeXp).toBe(40);
    for (const role of ["Producer", "Both", "Rapper"] as const) {
      saveCreatorRole("blaze", role);
      expect(dailyFromSavedCreatorRole("blaze", DAY, result.record)).toBe(result.record);
      const restored = JSON.parse(JSON.stringify(result.record));
      const unchanged = dailyFromSavedCreatorRole("blaze", DAY, restored)!;
      expect(unchanged).toEqual(result.record);
      expect(prepareDailyChallengeXp(unchanged, ledger, START + 2000)).toMatchObject({ status: "prepared", awards: [] });
    }
    saveCreatorRole("blaze", "Producer");
    const tomorrow = dailyFromSavedCreatorRole("blaze", "2026-10-25", null)!;
    expect(tomorrow.roleAtAssignment).toBe("Producer");
    expect(tomorrow.activities).toEqual([]);
    expect(() => dailyFromSavedCreatorRole("tonemadelt", DAY, result.record)).toThrow(RangeError);
    storageMock.getItem.mockImplementation(() => { throw new Error("unavailable"); });
    expect(dailyFromSavedCreatorRole("blaze", DAY, result.record)).toBe(result.record);
  });
});
