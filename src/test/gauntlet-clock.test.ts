import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clockAt, clockReducer, elapsedClock, readClock, saveClock } from "@/lib/gauntlet-clock";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Gauntlet creation deadlines", () => {
  it("starts creation exactly once when a specific kit is revealed", () => {
    const create = clockReducer(clockAt(0), {
      type: "kit-revealed",
      kitId: "sunday-service",
      now: 1000,
    });
    expect(create).toMatchObject({
      stage: 2,
      left: 900,
      until: 31000,
      revealedKitId: "sunday-service",
    });
    expect(clockReducer(create, { type: "kit-revealed", kitId: "sunday-service", now: 1200 })).toBe(
      create,
    );
    expect(clockReducer(create, { type: "kit-revealed", kitId: "different-kit", now: 1300 })).toBe(
      create,
    );
  });
  it("does not start a countdown just because a pre-reveal stage advances", () => {
    const beforeReveal = clockReducer(clockAt(0), { type: "advance", from: 0, now: 1000 });
    expect(elapsedClock(beforeReveal, 601000)).toMatchObject({
      stage: 1,
      left: 0,
      until: null,
      revealedKitId: null,
    });
    expect(clockReducer(beforeReveal, { type: "advance", from: 1, now: 601000 })).toBe(
      beforeReveal,
    );
    const revealed = clockReducer(beforeReveal, {
      type: "kit-revealed",
      kitId: "chosen-kit",
      now: 601000,
    });
    expect(revealed).toMatchObject({
      stage: 2,
      left: 900,
      until: 631000,
      revealedKitId: "chosen-kit",
    });
  });
  it("requires a kit identity and permits a fresh reveal only after restart", () => {
    const waiting = clockAt(0);
    expect(clockReducer(waiting, { type: "kit-revealed", kitId: " ", now: 1000 })).toBe(waiting);
    const create = clockReducer(waiting, { type: "kit-revealed", kitId: "first-kit", now: 1000 });
    const reset = clockReducer(create, { type: "reset", now: 2000 });
    expect(reset.revealedKitId).toBeNull();
    expect(
      clockReducer(reset, { type: "kit-revealed", kitId: "second-kit", now: 3000 }),
    ).toMatchObject({ stage: 2, left: 900, until: 33000, revealedKitId: "second-kit" });
  });
  it("initializes upload at the creation deadline and expires it at its own deadline", () => {
    const create = clockAt(2, 1, 1000);
    expect(elapsedClock(create, 900999)).toMatchObject({ stage: 2, left: 1 });
    const upload = elapsedClock(create, 901000);
    expect(upload).toMatchObject({ stage: 3, left: 180, until: 1081000 });
    expect(elapsedClock(upload, 1080999)).toMatchObject({ stage: 3, left: 1 });
    expect(elapsedClock(upload, 1081000)).toMatchObject({ stage: 4, left: 0, until: null });
  });
  it("counts time away through both windows instead of starting a fresh upload clock", () => {
    const create = clockAt(2, 30, 1000);
    expect(elapsedClock(create, 32000)).toMatchObject({ stage: 3, left: 150 });
    expect(elapsedClock(create, 37000)).toMatchObject({ stage: 4, left: 0 });
  });
  it("preserves fractional time when changing Demo speed", () => {
    const create = clockAt(2, 30, 1000);
    const normal = clockReducer(create, { type: "speed", speed: 1, now: 1500 });
    expect(normal).toMatchObject({ left: 885, until: 886500, speed: 1 });
    const fast = clockReducer(normal, { type: "speed", speed: 30, now: 2000 });
    expect(fast.until).toBeLessThanOrEqual(2000 + 884500 / 30);
    expect(elapsedClock(fast, 3000).left).toBe(855);
  });
  it("makes duplicate ticks idempotent and rejects a previous stage's queued transition", () => {
    const create = clockAt(2, 30, 1000);
    const ticked = clockReducer(create, { type: "tick", from: 2, now: 2000 });
    expect(clockReducer(ticked, { type: "tick", from: 2, now: 2000 })).toEqual(ticked);
    const upload = clockReducer(create, { type: "tick", from: 2, now: 31000 });
    expect(clockReducer(upload, { type: "advance", from: 2, now: 31000 })).toBe(upload);
  });
  it("restores from saved deadlines and persists an explicit restart", () => {
    saveClock(
      clockReducer(clockAt(0), { type: "kit-revealed", kitId: "sunday-service", now: 1000 }),
    );
    expect(readClock(7000)).toMatchObject({
      stage: 2,
      left: 720,
      until: 31000,
      revealedKitId: "sunday-service",
    });
    const reset = clockReducer(readClock(7000)!, { type: "reset", now: 7000 });
    saveClock(reset);
    expect(readClock(8000)).toMatchObject({ stage: 0, left: 0, until: null, speed: 30 });
  });
  it("keeps navigation deadlines in memory when browser storage is blocked", () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("Storage blocked");
      },
      setItem() {
        throw new Error("Storage blocked");
      },
    });
    saveClock(clockAt(2, 30, 1000));
    expect(readClock(7000)).toMatchObject({ stage: 2, left: 720, until: 31000 });
  });
  it("ignores corrupt or invalid persisted clocks", () => {
    const key = "arena-producer-gauntlet-clock-v1";
    for (const text of [
      "{broken",
      JSON.stringify({ stage: 8, speed: 30, until: null }),
      JSON.stringify({ stage: 2, speed: 30, until: null }),
    ]) {
      window.sessionStorage.setItem(key, text);
      expect(readClock(7000)).toBeNull();
    }
  });
});
