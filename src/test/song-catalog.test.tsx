import { StrictMode, type ComponentType } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/artist-quick-battle";
import { PlayerProvider } from "@/lib/player";
import { selectedSongTrack, songsFor } from "@/lib/song-catalog";
import {
  catalogSelectionStatus,
  lockCatalogItem,
  playableCatalogItem,
} from "@/lib/catalog-selection";
import { ARTIST_ROSTER } from "@/lib/artist-battle";

const search = vi.hoisted(() => ({ format: "song" as "song" | undefined }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => search,
    useNavigate: () => vi.fn(),
  }),
}));
vi.mock("@/lib/synth", () => ({
  beatUrl: vi.fn((seed: number, seconds: number) => `blob:demo-${seed}-${seconds}`),
  waveBars: () => [0.3, 0.7, 0.5],
  excerptWav: vi.fn(),
}));

class AudioMock {
  static instances: AudioMock[] = [];
  private source = "";
  get src() {
    return this.source;
  }
  set src(value: string) {
    this.source = value;
    this.currentTime = 0;
  }
  paused = true;
  volume = 0.7;
  currentTime = 0;
  duration = 30;
  onplay: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onloadedmetadata: (() => void) | null = null;
  play = vi.fn(async () => {
    this.paused = false;
    this.onplay?.();
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.onpause?.();
  });
  constructor() {
    AudioMock.instances.push(this);
  }
}

const Battle = Route.options.component as ComponentType;
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const audio = () => AudioMock.instances[AudioMock.instances.length - 1];
function mount() {
  return render(
    <StrictMode>
      <PlayerProvider>
        <Battle />
      </PlayerProvider>
    </StrictMode>,
  );
}
function selectSong(title = "City Dreams") {
  fireEvent.click(screen.getByRole("radio", { name: `Select ${title}` }));
  click("Lock selected song");
}
function enterSelection() {
  click("Ready Up");
  tick(2800);
  tick(800);
  expect(screen.getByRole("heading", { name: "Choose your profile song" })).toBeInTheDocument();
  expect(screen.getByText("3:00")).toBeInTheDocument();
}
function finishSelection() {
  for (let i = 0; i < 4; i++) tick(1000);
  expect(screen.getByRole("heading", { name: "Listen & Judge" })).toBeInTheDocument();
}

beforeEach(() => {
  search.format = "song";
  vi.useFakeTimers();
  vi.clearAllMocks();
  AudioMock.instances = [];
  for (const key of ["localStorage", "sessionStorage"]) {
    const saved = new Map<string, string>();
    vi.stubGlobal(key, {
      getItem: (id: string) => saved.get(id) ?? null,
      setItem: (id: string, value: string) => saved.set(id, value),
      removeItem: (id: string) => saved.delete(id),
      clear: () => saved.clear(),
    });
  }
  vi.stubGlobal("Audio", AudioMock);
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Catalog entry rules", () => {
  it("has existing Blaze profile songs and playable owned fixtures for every participant", () => {
    expect(songsFor("blaze").map((s) => s.id)).toEqual(["t5", "t6", "t7"]);
    for (const id of ARTIST_ROSTER) expect(songsFor(id).some(playableCatalogItem)).toBe(true);
  });
  it("rejects another owner's song, missing audio, blank URLs and invalid durations", () => {
    const mine = songsFor("blaze")[0];
    expect(lockCatalogItem(null, songsFor("novarae")[0], "battle", "blaze", true)).toBeNull();
    for (const invalid of [
      { ...mine, audio: null },
      { ...mine, audio: { kind: "url" as const, src: " " } },
      { ...mine, seconds: NaN },
    ]) {
      expect(lockCatalogItem(null, invalid, "battle", "blaze", true)).toBeNull();
    }
  });
  it("snapshots a stable song/source identity and never replaces a lock or accepts a late one", () => {
    const item = {
      ...songsFor("blaze")[0],
      audio: { kind: "url" as const, src: "blob:owned-song" },
    };
    const locked = lockCatalogItem(null, item, "battle-one", "blaze", true)!;
    item.audio.src = "blob:changed";
    expect(selectedSongTrack(locked)).toMatchObject({
      id: "catalog:battle-one:blaze:t5",
      src: "blob:owned-song",
    });
    expect(lockCatalogItem(locked, songsFor("blaze")[1], "battle-one", "blaze", true)).toBe(locked);
    expect(lockCatalogItem(null, item, "battle-one", "blaze", false)).toBeNull();
    const repeat = lockCatalogItem(null, item, "battle-two", "blaze", true)!;
    expect(selectedSongTrack(repeat).id).not.toBe(selectedSongTrack(locked).id);
  });
  it("distinguishes Waiting, Selecting, Locked In and Missed Deadline", () => {
    expect(catalogSelectionStatus(false, 0, 14, false)).toBe("Waiting");
    expect(catalogSelectionStatus(false, 10, 14, false)).toBe("Selecting");
    expect(catalogSelectionStatus(true, 180, 14, true)).toBe("Locked In");
    expect(catalogSelectionStatus(false, 180, null, true)).toBe("Missed Deadline");
  });
});

describe("Song-for-Song catalog selection", () => {
  it("opens a three-minute catalog phase after all eight ready, without an upload or demo fallback", () => {
    mount();
    enterSelection();
    expect(screen.queryByLabelText("Song file")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Artist performance")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use Demo Submission" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: /^Select / })).toHaveLength(3);
    expect(screen.getByRole("img", { name: "City Dreams demo artwork" })).toBeInTheDocument();
    expect(screen.getAllByText("0:30 · demo audio")).toHaveLength(3);
    expect(screen.getByText(/not stored user uploads/)).toBeInTheDocument();
  });
  it("previews the profile source, locks one song and waits for all eight before judging it from the start", () => {
    mount();
    enterSelection();
    click("Play City Dreams");
    expect(audio().src).toBe("blob:demo-25-30");
    audio().currentTime = 12;
    selectSong();
    expect(audio().paused).toBe(true);
    expect(screen.getByText("Locked In: City Dreams")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Select Higher Ground" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Listen & Judge" })).not.toBeInTheDocument();
    finishSelection();
    expect(screen.getByRole("heading", { name: "City Dreams" })).toBeInTheDocument();
    expect(audio().currentTime).toBe(0);
    expect(audio().src).toBe("blob:demo-25-30");
    expect(screen.getByText("You can't rate your own entry.")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "5 stars" })).not.toBeInTheDocument();
    click("Next Submission");
    expect(screen.getByRole("heading", { name: "Late Nights" })).toBeInTheDocument();
    expect(audio().src).toBe("blob:demo-21-30");
    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    expect(screen.getByRole("radio", { name: "5 stars" })).toHaveAttribute("aria-checked", "true");
    for (let i = 0; i < 7; i++) click("Next Submission");
    expect(screen.getByText(/Selection closed early with 1:00 left/)).toBeInTheDocument();
    expect(screen.getByText("City Dreams")).toBeInTheDocument();
    expect(localStorage.getItem("arena-beat-vault-v1")).toBeNull();
  });
  it("excludes the local artist on expiry even in Demo Mode, and cannot lock a stale selection", () => {
    mount();
    enterSelection();
    fireEvent.click(screen.getByRole("radio", { name: "Select City Dreams" }));
    const staleLock = screen.getByRole("button", { name: "Lock selected song" });
    for (let i = 0; i < 6; i++) tick(1000);
    expect(screen.getByRole("heading", { name: "Late Nights" })).toBeInTheDocument();
    fireEvent.click(staleLock);
    for (let i = 0; i < 7; i++) click("Next Submission");
    expect(screen.getByText("Missed deadline · not scored: You")).toBeInTheDocument();
    expect(screen.queryByText("You (Blaze)")).not.toBeInTheDocument();
    expect(screen.queryByText("City Dreams")).not.toBeInTheDocument();
  });
  it("excludes a missing simulated artist and keeps the locked entry through the full window", () => {
    mount();
    fireEvent.click(screen.getByRole("switch", { name: "Simulate a missed deadline" }));
    enterSelection();
    selectSong();
    for (let i = 0; i < 5; i++) tick(1000);
    expect(screen.getByText("Locked In: City Dreams")).toBeInTheDocument();
    tick(1000);
    expect(screen.getByText(/Entry 1 of 7 valid submissions/)).toBeInTheDocument();
    for (let i = 0; i < 7; i++) click("Next Submission");
    expect(screen.getByText("Missed deadline · not scored: Juno")).toBeInTheDocument();
  });
  it("runs at normal speed outside accelerated mode", () => {
    mount();
    fireEvent.click(screen.getByRole("switch", { name: "Demo mode" }));
    click("Skip");
    selectSong();
    tick(1000);
    expect(screen.getByText("2:59")).toBeInTheDocument();
    expect(screen.getByText("1 of 8 Locked In")).toBeInTheDocument();
  });
  it("clears locks on restart and loads the new song in a distinct battle", () => {
    mount();
    enterSelection();
    selectSong();
    finishSelection();
    click("Restart");
    expect(audio().paused).toBe(true);
    enterSelection();
    expect(screen.queryByText("Locked In: City Dreams")).not.toBeInTheDocument();
    selectSong("Higher Ground");
    finishSelection();
    expect(screen.getByRole("heading", { name: "Higher Ground" })).toBeInTheDocument();
    expect(audio().src).toBe("blob:demo-26-30");
  });
  it("restarts the same catalog song from zero rather than resuming previous battle audio", () => {
    mount();
    enterSelection();
    selectSong();
    finishSelection();
    audio().currentTime = 18;
    click("Restart");
    enterSelection();
    selectSong();
    finishSelection();
    expect(audio().src).toBe("blob:demo-25-30");
    expect(audio().currentTime).toBe(0);
  });
  it("stops audio on route unmount and clears timers", () => {
    const view = mount();
    enterSelection();
    click("Play City Dreams");
    const playing = audio();
    expect(playing.paused).toBe(false);
    view.unmount();
    expect(playing.paused).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("offers no entry when the local catalog audio is unavailable", () => {
    const own = songsFor("blaze");
    const original = own.map((song) => song.audio);
    try {
      own.forEach((song) => {
        song.audio = null;
      });
      mount();
      enterSelection();
      expect(screen.getByRole("status")).toHaveTextContent("No playable songs");
      expect(screen.getByRole("button", { name: "Lock selected song" })).toBeDisabled();
    } finally {
      own.forEach((song, i) => {
        song.audio = original[i];
      });
    }
  });
});

describe("Creation Battle regression", () => {
  it("keeps the Crate reveal, automatic 15-minute timer, upload window and demo judging", () => {
    search.format = undefined;
    mount();
    click("Skip");
    fireEvent.click(screen.getByRole("button", { name: "Vote A" }));
    click("Close Ballot");
    expect(screen.getByText("15:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download 60s Beat" })).toBeInTheDocument();
    for (let i = 0; i < 30; i++) tick(1000);
    expect(screen.getByLabelText("Artist performance")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Choose your profile song" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("3:00")).toBeInTheDocument();
    click("Use Demo Submission");
    click("Skip");
    expect(
      screen.getByRole("heading", { name: "Blaze — Demo Entry (simulated audio)" }),
    ).toBeInTheDocument();
    click("Next Submission");
    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByRole("radio", { name: "1 stars" }));
      click("Next Submission");
    }
    expect(screen.getByText("You won the full instrumental: Velvet Static")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("arena-beat-vault-v1")!)).toEqual([
      expect.objectContaining({ artistId: "blaze", beatId: "b8", status: "awarded" }),
    ]);
  });
  it("still validates and judges a newly recorded local Creation performance", async () => {
    search.format = undefined;
    mount();
    click("Skip");
    click("Skip");
    click("Skip");
    const globalAudio = audio();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = vi.fn(() => "blob:creation-performance");
        static override revokeObjectURL = vi.fn();
      },
    );
    fireEvent.change(screen.getByLabelText("Artist performance"), {
      target: { files: [new File(["audio"], "performance.wav", { type: "audio/wav" })] },
    });
    const metadata = audio();
    metadata.duration = 45;
    await act(async () => {
      metadata.onloadedmetadata?.();
    });
    expect(screen.getByText("performance.wav")).toBeInTheDocument();
    click("Skip");
    expect(
      screen.getByRole("heading", { name: "Your Entry · performance.wav" }),
    ).toBeInTheDocument();
    expect(globalAudio.src).toBe("blob:creation-performance");
  });
});
