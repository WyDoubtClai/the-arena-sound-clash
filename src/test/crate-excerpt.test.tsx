import { StrictMode, useState, type ComponentType } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExcerptSelector } from "@/components/arena/excerpt-selector";
import { PlayerProvider, usePlayer } from "@/lib/player";
import { excerptStart, excerptTime, maxExcerptStart } from "@/lib/excerpt";
import { beatUrl } from "@/lib/synth";
import { Route } from "@/routes/crate";

vi.mock("@/lib/synth", () => ({ beatUrl: vi.fn(() => "blob:demo"), waveBars: () => [0.3, 0.7] }));

const decode = vi.fn<(bytes: ArrayBuffer) => Promise<{ duration: number }>>();
const bytesFor = (duration: number) => new Float64Array([duration]).buffer;
class Source {
  buffer: unknown;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class Context {
  static instances: Context[] = [];
  currentTime = 0;
  destination = {};
  sources: Source[] = [];
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  decodeAudioData = (bytes: ArrayBuffer) => decode(bytes);
  createBufferSource = () => {
    const source = new Source();
    this.sources.push(source);
    return source;
  };
  constructor() {
    Context.instances.push(this);
  }
}
class GlobalAudio {
  static instances: GlobalAudio[] = [];
  paused = true;
  currentTime = 0;
  duration = 90;
  src = "";
  volume = 0.7;
  onplay: (() => void) | null = null;
  onpause: (() => void) | null = null;
  play = vi.fn(async () => {
    this.paused = false;
    this.onplay?.();
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.onpause?.();
  });
  constructor() {
    GlobalAudio.instances.push(this);
  }
}

function GlobalControls() {
  const player = usePlayer();
  return (
    <>
      <button
        onClick={() =>
          player.play({ id: "global", title: "Original track", artist: "Demo", seed: 42 })
        }
      >
        Play global
      </button>
      <button onClick={player.toggle}>Toggle global</button>
      <span>{player.track?.title}</span>
    </>
  );
}
function Harness() {
  const [valid, setValid] = useState(false);
  return (
    <>
      <ExcerptSelector onValidityChange={setValid} />
      <button disabled={!valid}>Submit</button>
      <GlobalControls />
    </>
  );
}
function mount() {
  return render(
    <StrictMode>
      <PlayerProvider>
        <Harness />
      </PlayerProvider>
    </StrictMode>,
  );
}
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const context = () => Context.instances[Context.instances.length - 1];
const audio = () => GlobalAudio.instances[GlobalAudio.instances.length - 1];
const slider = () => screen.getByRole("slider", { name: "Segment start" });
async function select(duration: number, name = "instrumental.wav") {
  const file = new File(["audio"], name, { type: "audio/wav" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytesFor(duration) });
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Full instrumental"), { target: { files: [file] } });
  });
}
async function preview() {
  click("Preview selected 60 seconds");
  await waitFor(() => expect(context().sources.length).toBeGreaterThan(0));
}

beforeEach(() => {
  Context.instances = [];
  GlobalAudio.instances = [];
  vi.clearAllMocks();
  decode
    .mockReset()
    .mockImplementation(async (bytes) => ({ duration: new Float64Array(bytes)[0] }));
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal("Audio", GlobalAudio);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ arrayBuffer: async () => bytesFor(96) })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Excerpt boundaries and timestamps", () => {
  it("clamps selections to measured durations without overrunning fractional ends", () => {
    expect(maxExcerptStart(127.259)).toBe(67.25);
    expect(excerptStart(999, 127.259)).toBe(67.25);
    expect(excerptStart(-10, 96)).toBe(0);
    expect(excerptStart(NaN, 96)).toBe(0);
    expect(excerptStart(12.34, 96)).toBe(12.34);
    expect(maxExcerptStart(Infinity)).toBe(0);
    expect(maxExcerptStart(59.99)).toBe(0);
  });
  it("formats fractional positions and minute boundaries accurately", () => {
    expect(excerptTime(36.12)).toBe("0:36.12");
    expect(excerptTime(96.12)).toBe("1:36.12");
    expect(excerptTime(59.999)).toBe("1:00.00");
  });
});

describe("Local Crate excerpt selector", () => {
  it("uses the decoded file duration and exposes accurate range bounds and timestamps", async () => {
    mount();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    await select(127.259);
    expect(screen.getByText("Full track 2:07.26")).toBeInTheDocument();
    expect(slider()).toHaveAttribute("max", "67.25");
    fireEvent.change(slider(), { target: { value: "36.12" } });
    expect(screen.getByText("60s competition segment: 0:36.12 – 1:36.12")).toBeInTheDocument();
    expect(slider()).toHaveAttribute("aria-valuetext", "0:36.12 to 1:36.12");
    fireEvent.change(slider(), { target: { value: "999" } });
    expect(screen.getByText("60s competition segment: 1:07.25 – 2:07.25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });
  it("accepts an exactly 60-second file with a fixed selection", async () => {
    mount();
    await select(60);
    expect(slider()).toBeDisabled();
    expect(screen.getByText("60s competition segment: 0:00.00 – 1:00.00")).toBeInTheDocument();
    await preview();
    expect(context().sources[0].start).toHaveBeenCalledWith(0, 0, 60);
  });
  it("rejects short files before preview or submission", async () => {
    mount();
    await select(59.99);
    expect(screen.getByRole("alert")).toHaveTextContent("at least 60 seconds");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(context().sources).toHaveLength(0);
  });
  it("handles decoding failures without leaving a valid previous selection", async () => {
    mount();
    await select(96);
    decode.mockRejectedValueOnce(new Error("Unsupported audio"));
    await select(96, "broken.wav");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("could not be decoded"),
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });
  it("reuses the local synthesizer for a playable 96-second demonstration", async () => {
    mount();
    click("Use 96-second demo");
    await screen.findByText("Full track 1:36.00");
    expect(beatUrl).toHaveBeenCalledWith(99, 96);
    expect(fetch).toHaveBeenCalledWith("blob:demo");
    expect(slider()).toHaveAttribute("max", "36");
  });
  it("schedules only the excerpt, pauses, resumes the remainder, and replays from its start", async () => {
    mount();
    await select(120);
    fireEvent.change(slider(), { target: { value: "20" } });
    await preview();
    const ctx = context();
    expect(ctx.sources[0].start).toHaveBeenCalledWith(0, 20, 60);
    ctx.currentTime = 12.5;
    click("Pause excerpt");
    expect(ctx.sources[0].stop).toHaveBeenCalledTimes(1);
    await preview();
    expect(ctx.sources[1].start).toHaveBeenCalledWith(0, 32.5, 47.5);
    act(() => ctx.sources[1].onended?.());
    await preview();
    expect(ctx.sources[2].start).toHaveBeenCalledWith(0, 20, 60);
  });
  it("stops playback and resets its offset when moving the selection", async () => {
    mount();
    await select(96);
    await preview();
    const ctx = context();
    ctx.currentTime = 5;
    fireEvent.change(slider(), { target: { value: "36" } });
    expect(ctx.sources[0].stop).toHaveBeenCalledTimes(1);
    await preview();
    expect(ctx.sources[1].start).toHaveBeenCalledWith(0, 36, 60);
  });
  it("shares audio focus with global play and toggle while retaining the original track position", async () => {
    mount();
    click("Play global");
    audio().currentTime = 12;
    await select(96);
    await preview();
    expect(audio().paused).toBe(true);
    expect(audio().currentTime).toBe(12);
    expect(screen.getByText("Original track")).toBeInTheDocument();
    click("Toggle global");
    expect(context().sources[0].stop).toHaveBeenCalledTimes(1);
    expect(audio().paused).toBe(false);
    await preview();
    click("Play global");
    expect(context().sources[1].stop).toHaveBeenCalledTimes(1);
    expect(audio().paused).toBe(false);
  });
  it("cancels a pending preview when the global player takes over", async () => {
    mount();
    await select(96);
    let resume!: () => void;
    context().resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resume = resolve;
        }),
    );
    click("Preview selected 60 seconds");
    click("Play global");
    await act(async () => resume());
    expect(context().sources).toHaveLength(0);
    expect(audio().paused).toBe(false);
  });
  it("reports playback rejection and allows retry", async () => {
    mount();
    await select(96);
    context().resume.mockRejectedValueOnce(new Error("Not allowed"));
    click("Preview selected 60 seconds");
    await screen.findByText("Playback could not start. Try Preview again.");
    await preview();
    expect(context().sources[0].start).toHaveBeenCalledWith(0, 0, 60);
  });
  it("disconnects a source that fails to start without trying to stop it", async () => {
    mount();
    await select(96);
    const failed = new Source();
    failed.start.mockImplementation(() => {
      throw new Error("Start failed");
    });
    vi.spyOn(context(), "createBufferSource").mockReturnValueOnce(failed);
    click("Preview selected 60 seconds");
    await screen.findByText("Playback could not start. Try Preview again.");
    expect(failed.disconnect).toHaveBeenCalledTimes(1);
    expect(failed.stop).not.toHaveBeenCalled();
    await preview();
    expect(context().sources[0].start).toHaveBeenCalledWith(0, 0, 60);
  });
  it("ignores stale decoding results after selecting another file", async () => {
    mount();
    let finish!: (value: { duration: number }) => void;
    decode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await select(200, "old.wav");
    const old = context();
    await select(96, "new.wav");
    await screen.findByText("Full track 1:36.00");
    await act(async () => finish({ duration: 200 }));
    expect(old.close).toHaveBeenCalledTimes(1);
    expect(slider()).toHaveAttribute("max", "36");
  });
  it("releases audio resources when replacing a file and when closing the actual Crate dialog", async () => {
    const Crate = Route.options.component as ComponentType;
    render(
      <PlayerProvider>
        <Crate />
      </PlayerProvider>,
    );
    click("Upload Beat");
    await select(96);
    await preview();
    const old = context();
    await select(120);
    expect(old.sources[0].stop).toHaveBeenCalledTimes(1);
    expect(old.sources[0].onended).toBeNull();
    expect(old.close).toHaveBeenCalledTimes(1);
    await preview();
    const latest = context();
    click("Close");
    expect(latest.sources[0].stop).toHaveBeenCalledTimes(1);
    expect(latest.close).toHaveBeenCalledTimes(1);
    click("Upload Beat");
    expect(screen.getByRole("button", { name: "Preview Submission" })).toBeDisabled();
  });
});
