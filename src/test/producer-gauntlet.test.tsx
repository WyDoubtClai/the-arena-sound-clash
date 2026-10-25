import { StrictMode, type ComponentType } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/gauntlet";

const player = vi.hoisted(() => ({ pause: vi.fn(), play: vi.fn(), isCurrent: () => false }));

vi.mock("@/lib/player", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/player")>()),
  usePlayer: () => player,
}));
vi.mock("@/lib/synth", () => ({
  beatUrl: vi.fn((seed: number, length: number) => `demo-${seed}-${length}.wav`),
  waveBars: () => [0.3, 0.7, 0.5],
}));

class DemoAudio {
  static instances: DemoAudio[] = [];
  src = "";
  paused = true;
  playbackRate = 1;
  currentTime = 0;
  onended: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  constructor() {
    DemoAudio.instances.push(this);
  }
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
}

const Gauntlet = Route.options.component as ComponentType;
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const kit = () => screen.getByRole("heading", { name: "Sample Kit Revealed: “Sunday Service”" });
const upload = () => screen.getByRole("heading", { name: "Upload Your Entry" });
const listening = () => screen.getByRole("heading", { name: "Your Entry" });

function readyUp() {
  click("Ready Up");
  advance(2800); // Seven simulated producers, 400ms apart.
  advance(800); // Room-ready delay.
  expect(kit()).toBeInTheDocument();
}

let view: ReturnType<typeof render>;
function mount() {
  return render(
    <StrictMode>
      <Gauntlet />
    </StrictMode>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  DemoAudio.instances = [];
  vi.clearAllMocks();
  const storage = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.stubGlobal("Audio", DemoAudio);
  view = mount();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Producer Gauntlet stage transitions", () => {
  it("starts once automatically at kit reveal, without waiting for a download", () => {
    readyUp();
    expect(screen.queryByRole("button", { name: "Start Creation" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cook time 🔥" })).toBeInTheDocument();
    expect(screen.getByText("15:00")).toBeInTheDocument();
    advance(1000);
    expect(screen.getByText("14:30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Kit" })).toBeInTheDocument();
    expect(kit()).toBeInTheDocument();
  });

  it("keeps all five samples previewable and downloadable without resetting the clock", () => {
    readyUp();
    advance(1000);
    const names = [
      "Dusty Rhodes Chord.wav",
      "Vinyl Crackle Loop.wav",
      "808 Boom (C).wav",
      "Choir Stab.wav",
      "Perc Shaker.wav",
    ];
    for (const [i, name] of names.entries()) {
      click(`Play ${name}`);
      expect(player.play).toHaveBeenLastCalledWith(
        expect.objectContaining({ seed: 200 + i, seconds: 8 }),
      );
      click(`Download ${name}`);
    }
    const downloads = vi.mocked(HTMLAnchorElement.prototype.click);
    expect(downloads).toHaveBeenCalledTimes(5);
    expect(downloads.mock.instances.map((link) => (link as HTMLAnchorElement).download)).toEqual(
      names,
    );
    expect(screen.getByText("14:30")).toBeInTheDocument();
    click("Download Kit");
    expect(downloads).toHaveBeenCalledTimes(10);
    expect(screen.getByRole("button", { name: "Download Kit Again" })).toBeInTheDocument();
    advance(1000);
    expect(screen.getByText("14:00")).toBeInTheDocument();
    expect(kit()).toBeInTheDocument();
  });

  it.each([
    { mode: "real-time", demo: false, creationMs: 900_000, uploadMs: 180_000 },
    { mode: "30× demo", demo: true, creationMs: 30_000, uploadMs: 6000 },
  ])(
    "preserves the full creation and upload windows in $mode",
    ({ demo, creationMs, uploadMs }) => {
      readyUp();
      if (!demo) fireEvent.click(screen.getByRole("switch", { name: "Demo mode" }));
      advance(creationMs - 1000);
      expect(screen.getByRole("heading", { name: "Cook time 🔥" })).toBeInTheDocument();
      expect(screen.getByText(demo ? "0:30" : "0:01")).toBeInTheDocument();
      advance(1000);
      expect(upload()).toBeInTheDocument();
      expect(screen.getByText("3:00")).toBeInTheDocument();
      advance(uploadMs - 1000);
      expect(upload()).toBeInTheDocument();
      advance(1000);
      expect(listening()).toBeInTheDocument();
      expect(DemoAudio.instances).toHaveLength(1);
      advance(2000);
      expect(listening()).toBeInTheDocument();
      expect(DemoAudio.instances[0].play).toHaveBeenCalledTimes(1);
    },
  );

  it("switches acceleration without resetting time or leaving old timers running", () => {
    readyUp();
    advance(1000);
    expect(screen.getByText("14:30")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Demo mode" }));
    advance(1000);
    expect(screen.getByText("14:29")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Demo mode" }));
    advance(1000);
    expect(screen.getByText("13:59")).toBeInTheDocument();
  });

  it("advances only once when Skip and countdown expiry arrive together", () => {
    readyUp();
    advance(29_999);
    act(() => {
      vi.advanceTimersByTime(1);
      click("Skip");
    });
    expect(upload()).toBeInTheDocument();
    expect(screen.getByText("3:00")).toBeInTheDocument();
    advance(1000);
    expect(upload()).toBeInTheDocument();
    expect(screen.getByText("2:30")).toBeInTheDocument();
  });

  it("skips one stage at a time and keeps judging all eight entries before results", () => {
    click("Skip");
    expect(kit()).toBeInTheDocument();
    expect(screen.getByText("15:00")).toBeInTheDocument();
    click("Skip");
    expect(upload()).toBeInTheDocument();
    expect(screen.getByText("3:00")).toBeInTheDocument();
    click("Simulate upload");
    click("Lock In & Continue");
    expect(listening()).toBeInTheDocument();
    expect(screen.getByText("You can't rate your own entry.")).toBeInTheDocument();
    for (let entry = 2; entry <= 8; entry++) {
      if (entry === 2) click("Skip");
      else act(() => DemoAudio.instances[0].onended?.());
      expect(
        screen.getByText(`Beat ${entry} of 8 · Synchronized for all listeners`),
      ).toBeInTheDocument();
    }
    click("Skip");
    expect(screen.getByRole("heading", { name: "Final Results" })).toBeInTheDocument();
  });

  it("clears listening callbacks and entry state on restart", () => {
    for (let stage = 0; stage < 3; stage++) click("Skip");
    click("Skip");
    const previousAudio = DemoAudio.instances[0];
    click("Restart");
    expect(previousAudio.paused).toBe(true);
    expect(previousAudio.onended).toBeNull();
    expect(previousAudio.ontimeupdate).toBeNull();
    for (let stage = 0; stage < 3; stage++) click("Skip");
    expect(listening()).toBeInTheDocument();
    expect(DemoAudio.instances).toHaveLength(2);
  });

  it.each(["creation", "upload"])(
    "restarts from %s with a fresh clock and required kit reveal",
    (stage) => {
      readyUp();
      click("Download Kit");
      if (stage === "upload") {
        click("Skip");
        click("Simulate upload");
      }
      advance(1999);
      click("Restart");
      expect(screen.getByRole("heading", { name: "Waiting Room" })).toBeInTheDocument();
      advance(10_000);
      expect(screen.getByRole("heading", { name: "Waiting Room" })).toBeInTheDocument();
      click("Ready Up");
      advance(800);
      expect(kit()).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Download Kit" })).toBeInTheDocument();
      expect(kit()).toBeInTheDocument();
      expect(screen.getByText("15:00")).toBeInTheDocument();
      advance(1000);
      expect(screen.getByText("14:30")).toBeInTheDocument();
      click("Skip");
      expect(upload()).toBeInTheDocument();
      expect(screen.getByText("3:00")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Lock In & Continue" })).toBeDisabled();
    },
  );

  it("retains the creation deadline and kit access across navigation", () => {
    readyUp();
    advance(1000);
    view.unmount();
    advance(5000);
    view = mount();
    expect(kit()).toBeInTheDocument();
    expect(screen.getByText("12:00")).toBeInTheDocument();
    advance(1000);
    expect(screen.getByText("11:30")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Creation" })).not.toBeInTheDocument();
  });

  it("uses elapsed time while away instead of granting a fresh upload window", () => {
    readyUp();
    view.unmount();
    advance(31_000);
    view = mount();
    expect(upload()).toBeInTheDocument();
    expect(screen.getByText("2:30")).toBeInTheDocument();
    advance(5000);
    expect(listening()).toBeInTheDocument();
  });

  it("restores the submission and judging position with ratings rather than restarting the battle", () => {
    readyUp();
    click("Skip");
    click("Simulate upload");
    advance(1000);
    view.unmount();
    advance(1000);
    view = mount();
    expect(upload()).toBeInTheDocument();
    expect(screen.getByText("2:00")).toBeInTheDocument();
    expect(screen.getByText("✓ sunday_service_flip_FINAL.wav")).toBeInTheDocument();
    click("Lock In & Continue");
    click("Skip");
    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    view.unmount();
    advance(1000);
    view = mount();
    expect(screen.getByText("Beat 2 of 8 · Synchronized for all listeners")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "5 stars" })).toHaveAttribute("aria-checked", "true");
    expect(DemoAudio.instances[0].paused).toBe(true);
    expect(DemoAudio.instances[1].src).toBe("demo-101-45.wav");
  });

  it("cancels the pending room-ready transition when restarted", () => {
    click("Ready Up");
    advance(2800);
    advance(799);
    click("Restart");
    advance(4000);
    expect(screen.getByRole("heading", { name: "Waiting Room" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ready Up" })).toBeEnabled();
  });
});
