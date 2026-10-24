import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { beatUrl } from "./synth";

export type Track = { id: string; title: string; artist: string; seed: number; genre?: string };

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
    a.ontimeupdate = () => setTime(a.currentTime);
    a.onloadedmetadata = () => setDuration(a.duration || 30);
    a.onended = () => setPlaying(false);
    audio.current = a;
    return () => a.pause();
  }, []);

  const play = useCallback((t: Track) => {
    const a = audio.current;
    if (!a) return;
    if (track?.id !== t.id) {
      a.src = beatUrl(t.seed);
      setTrack(t);
      setTime(0);
    }
    void a.play();
  }, [track]);

  const value: PlayerState = {
    track, playing, time, duration, volume, play,
    toggle: () => {
      const a = audio.current;
      if (!a || !track) return;
      if (a.paused) void a.play(); else a.pause();
    },
    pause: () => audio.current?.pause(),
    seek: (s) => { if (audio.current) audio.current.currentTime = s; },
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
