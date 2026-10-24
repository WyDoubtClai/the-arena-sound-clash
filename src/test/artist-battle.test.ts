import { describe, expect, it } from "vitest";
import { beats } from "@/lib/data";
import { ARTIST_ROSTER, ARTIST_DURATIONS, DEMO_SPEED, PERFORMANCE_LIMIT, UPLOAD_LIMITS, canRate, closeBallot, drawBeats, eligibleBeats, rankArtists } from "@/lib/artist-battle";

describe("Artist Quick Battle rules", () => {
  it("has eight distinct artists", () => { expect(new Set(ARTIST_ROSTER).size).toBe(8); });
  it("draws four beats from the shared library", () => { const drawn = drawBeats(); expect(drawn).toHaveLength(4); expect(new Set(drawn.map((b) => b.id)).size).toBe(4); drawn.forEach((beat) => expect(beats).toContain(beat)); });
  it("rejects competition segments shorter than 60 seconds", () => { expect(eligibleBeats([{ ...beats[0], segment: "0:42–1:41" }])).toHaveLength(0); expect(PERFORMANCE_LIMIT).toBe(60); });
  it("rejects segments outside the full instrumental", () => { expect(eligibleBeats([{ ...beats[0], segment: "2:00–3:00" }])).toHaveLength(0); });
  it("counts seven simulated votes and the user's single vote", () => { const ballot = closeBallot(beats.slice(0, 4), beats[1].id); expect(ballot.counts.map((row) => row.count)).toEqual([2, 3, 2, 1]); expect(ballot.total).toBe(8); expect(ballot.winner?.id).toBe(beats[1].id); });
  it("uses a repeatable seeded random tiebreaker", () => { const a = closeBallot(beats.slice(0, 4), beats[3].id); expect(a.tied).toBe(true); expect(a.counts.map((row) => row.count)).toEqual([2, 2, 2, 2]); expect(a.winner?.id).toBe("b1"); expect(closeBallot(beats.slice(0, 4), beats[3].id).winner?.id).toBe(a.winner?.id); expect(closeBallot(beats.slice(0, 4), beats[3].id, 99999).winner?.id).not.toBe(a.winner?.id); });
  it("gives creation exactly 15 minutes", () => { expect(ARTIST_DURATIONS[3]).toBe(900); });
  it("gives upload exactly 3 minutes", () => { expect(ARTIST_DURATIONS[4]).toBe(180); });
  it("accelerates demo timers by 30", () => { expect(DEMO_SPEED).toBe(30); });
  it("blocks self-rating, including in results", () => { expect(canRate("blaze", "blaze")).toBe(false); expect(rankArtists({ 0: 5 }).find((r) => r.id === "blaze")?.avg).toBe(rankArtists({}).find((r) => r.id === "blaze")?.avg); expect(canRate("novarae", "blaze")).toBe(true); });
  it("allows 3 uploads per rolling 24 hours", () => { expect(UPLOAD_LIMITS[0]).toBe(3); });
  it("allows 10 uploads per seven days", () => { expect(UPLOAD_LIMITS[1]).toBe(10); });
  it("allows 30 active listings", () => { expect(UPLOAD_LIMITS[2]).toBe(30); });
});