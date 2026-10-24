// Procedurally renders short demo beats to WAV blob URLs (no external audio files).
const cache = new Map<number, string>();
const raw = new Map<number, ArrayBuffer>();

function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Deterministic full-length render: the same (seed, seconds) always yields byte-identical WAV data. */
export function renderWav(seed: number, seconds = 30): ArrayBuffer {
  const sr = 22050;
  const n = sr * seconds;
  const data = new Float32Array(n);
  const r = rng(seed + 1);
  let noiseState = (seed * 2654435761) >>> 0 || 1;
  const noise = () => { noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0; return noiseState / 4294967296; };
  const bpm = 80 + Math.floor(r() * 60);
  const beat = (60 / bpm) * sr;
  const scale = [0, 3, 5, 7, 10, 12];
  const root = 40 + Math.floor(r() * 12);
  const pattern = Array.from({ length: 16 }, () => r());
  const notes = Array.from({ length: 8 }, () => scale[Math.floor(r() * scale.length)]);
  for (let i = 0; i < n; i++) {
    const step = Math.floor(i / (beat / 4));
    const inStep = i % (beat / 4);
    const s16 = step % 16;
    let v = 0;
    if (s16 % 8 === 0 || pattern[s16] > 0.85) {
      const t = inStep / sr;
      v += Math.sin(2 * Math.PI * (50 + 120 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9) * 0.8;
    }
    if (s16 % 8 === 4) {
      const t = inStep / sr;
      v += (noise() * 2 - 1) * Math.exp(-t * 18) * 0.35;
    }
    if (s16 % 2 === 0) {
      const t = inStep / sr;
      v += (noise() * 2 - 1) * Math.exp(-t * 90) * 0.12;
    }
    const bar = Math.floor(i / (beat * 2)) % 8;
    const f = 440 * Math.pow(2, (root + notes[bar] - 69 + 12) / 12);
    const t = i / sr;
    v += Math.sin(2 * Math.PI * f * t) * 0.08 + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.04;
    data[i] = Math.max(-1, Math.min(1, v * 0.7));
  }
  for (let i = 0; i < sr * 0.3; i++) {
    data[i] *= i / (sr * 0.3);
    data[n - 1 - i] *= i / (sr * 0.3);
  }
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, k) => dv.setUint8(o + k, c.charCodeAt(0)));
  w(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, data[i] * 32767, true);
  return buf;
}

export function beatUrl(seed: number, seconds = 30): string {
  if (typeof window === "undefined") return "";
  const hit = cache.get(seed * 1000 + seconds);
  if (hit) return hit;
  const buf = renderWav(seed, seconds);
  const url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  cache.set(seed * 1000 + seconds, url);
  raw.set(seed * 1000 + seconds, buf);
  return url;
}

/** The complete render the player streams and every excerpt is sliced from. */
export function fullWav(seed: number, seconds: number): Blob | null {
  if (!beatUrl(seed, seconds)) return null;
  const buf = raw.get(seed * 1000 + seconds);
  return buf ? new Blob([buf], { type: "audio/wav" }) : null;
}

export function waveBars(seed: number, count = 48): number[] {
  const r = rng(seed + 7);
  return Array.from({ length: count }, (_, i) => 0.2 + 0.8 * Math.abs(Math.sin(i * 0.5 + seed)) * (0.5 + r() * 0.5));
}

/** Cuts [start, start+length) out of a 16-bit mono PCM WAV, keeping the sample data byte-identical. */
export function sliceWav(buf: ArrayBuffer, start: number, length: number): ArrayBuffer {
  const dv = new DataView(buf);
  const sr = dv.getUint32(24, true);
  const total = (buf.byteLength - 44) / 2;
  const from = Math.min(total, Math.round(start * sr));
  const n = Math.max(0, Math.min(total, Math.round((start + length) * sr)) - from);
  const out = new ArrayBuffer(44 + n * 2);
  new Uint8Array(out).set(new Uint8Array(buf, 0, 44));
  const o = new DataView(out);
  o.setUint32(4, 36 + n * 2, true);
  o.setUint32(40, n * 2, true);
  new Uint8Array(out, 44).set(new Uint8Array(buf, 44 + from * 2, n * 2));
  return out;
}

/** The exact excerpt of the same rendered audio the shared player streams for (seed, seconds). */
export function excerptWav(seed: number, seconds: number, start: number, length: number): Blob | null {
  if (!beatUrl(seed, seconds)) return null;
  const buf = raw.get(seed * 1000 + seconds);
  return buf ? new Blob([sliceWav(buf, start, length)], { type: "audio/wav" }) : null;
}
