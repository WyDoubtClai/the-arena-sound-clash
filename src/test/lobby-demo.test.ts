import { describe, expect, it } from "vitest";
import { posts } from "@/lib/data";
import { cleanBody, commentCount, emptyLobby, readLobby, selectPosts, toggleId, topicFilter } from "@/lib/lobby-demo";

describe("Lobby local demo interactions", () => {
  it("rejects empty post and comment bodies", () => {
    expect(cleanBody(" \n\t ")).toBe("");
    expect(cleanBody("  A verse idea  ")).toBe("A verse idea");
  });
  it("preserves seed posts when local additions survive refresh", () => {
    const state = emptyLobby();
    state.posts = [{ id: "local", author: "blaze", body: "A new collaboration", cat: "Collabs", time: "now", likes: 0, comments: 0 }];
    const restored = readLobby(JSON.stringify(state));
    expect(selectPosts(restored, "All", "", false)).toHaveLength(posts.length + 1);
    expect(selectPosts(restored, "Collabs", "new collaboration", false).map((p) => p.id)).toEqual(["local"]);
  });
  it("counts new comments and shallow replies on top of sample totals", () => {
    const state = emptyLobby();
    state.comments = [{ id: "c", postId: "p1", author: "blaze", body: "Great drums" }, { id: "r", postId: "p1", author: "blaze", body: "Love the swing", parentId: "c" }];
    expect(commentCount(posts[0], state)).toBe(44);
    expect(commentCount(posts[1], state)).toBe(63);
  });
  it("toggles likes, saves and follows reversibly and persists them", () => {
    const state = emptyLobby();
    for (const key of ["liked", "saved", "following", "commentLikes"] as const) {
      state[key] = toggleId(state[key], "p1");
      expect(readLobby(JSON.stringify(state))[key]).toEqual(["p1"]);
      expect(toggleId(state[key], "p1")).toEqual([]);
    }
  });
  it("filters saved conversations and maps collaboration topics", () => {
    const state = emptyLobby(); state.saved = ["p4"];
    expect(selectPosts(state, "All", "", false, true).map((p) => p.id)).toEqual(["p4"]);
    expect(topicFilter("Collab Requests").category).toBe("Collabs");
  });
  it("handles broken storage without replacing seeded content", () => {
    expect(selectPosts(readLobby("{broken"), "All", "", false)).toHaveLength(posts.length);
    expect(readLobby(JSON.stringify({ posts: [{ id: "bad", body: " " }] })).posts).toEqual([]);
  });
});