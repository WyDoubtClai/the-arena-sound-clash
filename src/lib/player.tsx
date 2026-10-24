import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { beatUrl } from "./synth";

export type Track = { id: string; title: string; artist: string; seed: number; genre?: string; seconds?: number; segmentStart?: number; segmentDuration?: number };

type PlayerState = {
  track: Track | null;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  play: (t: Track) => void;
  toggle: () => void;
  pause: () => void;
  seek: (s: number) => void;
  setVolume: (v: number) => void;
  isCurrent: (id: string) => boolean;
};

const Ctx = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const active = useRef<Track | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [volume, setVol] = useState(0.7);

  useEffect(() => {
    const a = new Audio();
    a.volume = 0.7;
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    a.ontimeupdate = () => {
      const t = active.current;
      const elapsed = a.currentTime - (t?.segmentStart ?? 0);
      const limit = t?.segmentDuration ?? (Number.isFinite(a.duration) ? a.duration : (t?.seconds ?? 30));
      setTime(Math.max(0, Math.min(elapsed, limit)));
      if (t?.segmentDuration && elapsed >= t.segmentDuration) a.pause();
    };
    a.onloadedmetadata = () => {
      const t = active.current;
      setDuration(t?.segmentDuration ?? (a.duration || 30));
      if (t?.segmentStart) a.currentTime = t.segmentStart;
    };
    a.onended = () => setPlaying(false);
    audio.current = a;
    return () => a.pause();
  }, []);

  const play = useCallback((t: Track) => {
    const a = audio.current;
    if (!a) return;
    if (track?.id !== t.id) {
      active.current = t;
      a.src = beatUrl(t.seed, t.seconds ?? 30);
      setTrack(t);
      setTime(0);
      setDuration(t.segmentDuration ?? t.seconds ?? 30);
    }
    if (t.segmentDuration && a.currentTime >= (t.segmentStart ?? 0) + t.segmentDuration) a.currentTime = t.segmentStart ?? 0;
    void a.play().catch(() => setPlaying(false));
  }, [track]);

  const value: PlayerState = {
    track, playing, time, duration, volume, play,
    toggle: () => {
      const a = audio.current;
      if (!a || !track) return;
      if (a.paused) {
        if (track.segmentDuration && a.currentTime >= (track.segmentStart ?? 0) + track.segmentDuration) a.currentTime = track.segmentStart ?? 0;
        void a.play().catch(() => setPlaying(false));
      } else a.pause();
    },
    pause: () => audio.current?.pause(),
    seek: (s) => { if (audio.current) audio.current.currentTime = Math.max(0, Math.min(s, duration)) + (track?.segmentStart ?? 0); },
    setVolume: (v) => { setVol(v); if (audio.current) audio.current.volume = v; },
    isCurrent: (id) => track?.id === id && playing,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer outside provider");
  return c;
}

export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
