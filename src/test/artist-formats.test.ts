import { describe, expect, it } from "vitest";
import { ARTIST_STAGES, SONG_STAGES, UPLOAD_WINDOW, ballotLabel, rankEntries, shouldCloseUpload, submittedIds, uploadSchedule, uploadStatus, validateAudioFile } from "@/lib/artist-battle";
import { sliceWav } from "@/lib/synth";

describe("Artist Quick Battle formats", () => {
  it("Creation has seven stages and Song-for-Song four, without draw or creation", () => {
    expect(ARTIST_STAGES).toHaveLength(7);
    expect(SONG_STAGES).toEqual(["Waiting Room", "3-Minute Upload", "Listen & Judge", "Results"]);
  });
  it("upload window is three minutes", () => { expect(UPLOAD_WINDOW).toBe(180); });
  it("never advances on the local submission alone", () => {
    const s = uploadSchedule(false);
    expect(submittedIds(s, 0, true)).toEqual(["blaze"]);
    expect(shouldCloseUpload(1, 170)).toBe(false);
  });
  it("advances early once all eight have submitted", () => {
    const ids = submittedIds(uploadSchedule(false), 120, true);
    expect(ids).toHaveLength(8);
    expect(shouldCloseUpload(ids.length, UPLOAD_WINDOW - 120)).toBe(true);
  });
  it("simulated artists are not reported submitted before their time", () => {
    expect(submittedIds(uploadSchedule(false), 60, true)).toHaveLength(5);
  });
  it("on expiry, missing artists are marked missed and excluded from scoring", () => {
    const s = uploadSchedule(true);
    const ids = submittedIds(s, UPLOAD_WINDOW, false);
    expect(ids).toHaveLength(6);
    expect(uploadStatus(s["juno"], UPLOAD_WINDOW, true)).toBe("Missed Deadline");
    expect(rankEntries({}, ids).map((r) => r.id)).not.toContain("juno");
    expect(rankEntries({}, [])).toEqual([]);
    expect(rankEntries({}, ["novarae"])).toHaveLength(1);
  });
  it("rejects empty and unsupported files; 60s limit only in creation", () => {
    expect(validateAudioFile({ name: "a.wav", type: "audio/wav", size: 0 }, "song")).toBeTruthy();
    expect(validateAudioFile({ name: "a.txt", type: "text/plain", size: 9 }, "song")).toBeTruthy();
    expect(validateAudioFile({ name: "a.mp3", type: "audio/mpeg", size: 9 }, "creation", 95)).toBeTruthy();
    expect(validateAudioFile({ name: "a.mp3", type: "audio/mpeg", size: 9 }, "song", 240)).toBeNull();
  });
  it("labels plurality versus majority winners", () => {
    expect(ballotLabel(3, 8)).toBe("Plurality winner");
    expect(ballotLabel(4, 8)).toBe("Plurality winner");
    expect(ballotLabel(5, 8)).toBe("Majority winner");
  });
  it("excerpt slice keeps the exact sample bytes", () => {
    const sr = 10, n = 100, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    dv.setUint32(24, sr, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, i, true);
    const out = new DataView(sliceWav(buf, 2, 6));
    expect(out.getUint32(40, true)).toBe(120);
    expect(out.getInt16(44, true)).toBe(20);
    expect(out.getInt16(44 + 59 * 2, true)).toBe(79);
  });
});
