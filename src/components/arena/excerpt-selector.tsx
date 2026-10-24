import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/lib/player";
import { beatUrl } from "@/lib/synth";
import { EXCERPT_SECONDS, excerptStart, excerptTime, maxExcerptStart } from "@/lib/excerpt";
import { Waveform } from "./bits";

type Selection = { file: File | null };
type Preview = {
  context: AudioContext;
  buffer: AudioBuffer | null;
  node: AudioBufferSourceNode | null;
  offset: number;
  beganAt: number;
  attempt: number;
  release: (() => void) | null;
};

export function ExcerptSelector({
  onValidityChange,
}: {
  onValidityChange: (valid: boolean) => void;
}) {
  const { requestAudioFocus } = usePlayer();
  const labelId = useId();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<Preview | null>(null);

  const pause = useCallback(() => {
    const preview = current.current;
    if (!preview) return;
    preview.attempt++;
    if (preview.node) {
      preview.offset = Math.min(
        EXCERPT_SECONDS,
        preview.offset + preview.context.currentTime - preview.beganAt,
      );
      preview.node.onended = null;
      preview.node.stop();
      preview.node.disconnect();
      preview.node = null;
    }
    preview.release?.();
    preview.release = null;
    setPlaying(false);
  }, []);

  useEffect(() => {
    onValidityChange(false);
    setDuration(0);
    setStart(0);
    setError("");
    setPlaying(false);
    if (!selection) return;
    const file = selection.file;
    setLoading(true);
    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch {
      setLoading(false);
      setError("Audio preview is not available in this browser.");
      return;
    }
    const preview: Preview = {
      context,
      buffer: null,
      node: null,
      offset: 0,
      beganAt: 0,
      attempt: 0,
      release: null,
    };
    current.current = preview;
    let cancelled = false;
    async function load() {
      try {
        const bytes = file
          ? await file.arrayBuffer()
          : await (await fetch(beatUrl(99, 96))).arrayBuffer();
        const buffer = await context.decodeAudioData(bytes);
        if (cancelled) return;
        if (!Number.isFinite(buffer.duration) || buffer.duration <= 0)
          throw new Error("Invalid duration");
        if (buffer.duration < EXCERPT_SECONDS) {
          setError("Choose an instrumental at least 60 seconds long. This file is too short.");
          return;
        }
        preview.buffer = buffer;
        setDuration(buffer.duration);
        onValidityChange(true);
      } catch {
        if (!cancelled) setError("This audio could not be decoded. Try a valid WAV or MP3 file.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      pause();
      current.current = null;
      preview.buffer = null;
      void context.close().catch(() => {});
    };
  }, [selection, onValidityChange, pause]);

  function move(value: number) {
    pause();
    if (current.current) current.current.offset = 0;
    setStart(excerptStart(value, duration));
  }

  async function play() {
    const preview = current.current;
    if (!preview?.buffer) return;
    preview.release = requestAudioFocus(pause);
    const attempt = ++preview.attempt;
    setPlaying(true);
    setError("");
    try {
      await preview.context.resume();
      if (current.current !== preview || preview.attempt !== attempt) return;
      if (preview.offset >= EXCERPT_SECONDS) preview.offset = 0;
      const node = preview.context.createBufferSource();
      node.buffer = preview.buffer;
      node.connect(preview.context.destination);
      node.onended = () => {
        if (preview.node !== node) return;
        node.disconnect();
        preview.node = null;
        preview.offset = EXCERPT_SECONDS;
        preview.release?.();
        preview.release = null;
        setPlaying(false);
      };
      preview.beganAt = preview.context.currentTime;
      // Schedule the end in the audio engine, not a throttled UI timer.
      try {
        node.start(0, start + preview.offset, EXCERPT_SECONDS - preview.offset);
      } catch (error) {
        node.disconnect();
        throw error;
      }
      preview.node = node;
      setPlaying(true);
    } catch {
      if (current.current !== preview || preview.attempt !== attempt) return;
      pause();
      setError("Playback could not start. Try Preview again.");
    }
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-2 rounded-lg border border-dashed p-4">
        <span className="text-sm font-semibold">Full instrumental · WAV / MP3</span>
        <input
          type="file"
          accept="audio/*"
          aria-label="Full instrumental"
          className="block w-full min-w-0 text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              pause();
              setSelection({ file });
            }
            e.target.value = "";
          }}
        />
        {selection && (
          <span className="block break-all text-xs text-teal">
            {selection.file?.name ?? "Locally synthesized demo"} · local preview only
          </span>
        )}
      </label>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          pause();
          setSelection({ file: null });
        }}
      >
        Use 96-second demo
      </Button>
      {loading && (
        <p role="status" className="text-xs text-muted-foreground">
          Reading audio duration…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-coral">
          {error}
        </p>
      )}
      {duration >= EXCERPT_SECONDS && (
        <div className="rounded-xl border bg-background p-3">
          <p id={labelId} className="mb-2 text-sm font-semibold">
            60s competition segment: {excerptTime(start)} – {excerptTime(start + EXCERPT_SECONDS)}
          </p>
          <div className="relative overflow-hidden">
            <Waveform seed={99} bars={90} className="h-14" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 rounded-md border-2 border-violet bg-violet/20"
              style={{
                left: `${(start / duration) * 100}%`,
                width: `${(EXCERPT_SECONDS / duration) * 100}%`,
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>0:00.00</span>
            <span>Full track {excerptTime(duration)}</span>
          </div>
          <input
            type="range"
            aria-label="Segment start"
            aria-describedby={labelId}
            aria-valuetext={`${excerptTime(start)} to ${excerptTime(start + EXCERPT_SECONDS)}`}
            min={0}
            max={maxExcerptStart(duration)}
            step={0.01}
            value={start}
            onChange={(e) => move(Number(e.target.value))}
            disabled={maxExcerptStart(duration) === 0}
            className="my-2 h-11 w-full cursor-pointer accent-[var(--violet)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
          />
          <Button type="button" variant="outline" onClick={() => (playing ? pause() : void play())}>
            {playing ? "Pause excerpt" : "Preview selected 60 seconds"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Illustrative waveform · selection precision 0.01 seconds. Changing the selection resets
            playback.
          </p>
        </div>
      )}
    </div>
  );
}
