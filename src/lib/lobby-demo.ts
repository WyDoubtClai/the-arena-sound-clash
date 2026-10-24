import { people, posts, type Post, type PostCat } from "@/lib/data";

export type LobbyPost = Post & { createdAt?: number; collaborator?: string; style?: string };
export type Comment = { id: string; postId: string; author: string; body: string; parentId?: string; createdAt?: number };
export type LobbyState = { posts: LobbyPost[]; comments: Comment[]; liked: string[]; saved: string[]; following: string[]; commentLikes: string[] };
export const STORAGE_KEY = "arena-lobby-demo-v1";
export const emptyLobby = (): LobbyState => ({ posts: [], comments: [], liked: [], saved: [], following: [], commentLikes: [] });
export const cleanBody = (value: string) => value.trim();
export const toggleId = (ids: string[], id: string) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
const authors = new Set(people.map((p) => p.id));
const categories: PostCat[] = ["Discussions", "Questions", "Collabs", "Battles", "Feedback"];
export function readLobby(raw: string | null): LobbyState {
  if (!raw) return emptyLobby();
  try {
    const value = JSON.parse(raw);
    const ids = (key: string) => Array.isArray(value[key]) ? value[key].filter((x: unknown) => typeof x === "string") : [];
    return {
      posts: Array.isArray(value.posts) ? value.posts.filter((p: LobbyPost) => p && typeof p.id === "string" && authors.has(p.author) && categories.includes(p.cat) && typeof p.body === "string" && cleanBody(p.body) && typeof p.likes === "number" && typeof p.comments === "number" && (!p.audio || (typeof p.audio.title === "string" && typeof p.audio.seed === "number"))) : [],
      comments: Array.isArray(value.comments) ? value.comments.filter((c: Comment) => c && typeof c.id === "string" && typeof c.postId === "string" && authors.has(c.author) && typeof c.body === "string" && cleanBody(c.body) && (!c.parentId || typeof c.parentId === "string")) : [],
      liked: ids("liked"), saved: ids("saved"), following: ids("following"), commentLikes: ids("commentLikes"),
    };
  } catch { return emptyLobby(); }
}
export const sampleComments: Comment[] = [
  { id: "sample-p1", postId: "p1", author: "tonemadelt", body: "The texture has character. I'd leave more space around the kick." },
  { id: "sample-p2", postId: "p2", author: "miasoul", body: "I write first, then record a rough take before polishing the lyrics." },
  { id: "sample-p3", postId: "p3", author: "judgeraye", body: "Start with the performance. A lighter chain often keeps the vocal more natural." },
  { id: "sample-p4", postId: "p4", author: "miasoul", body: "Interested in singing on this. What mood are you going for?" },
  { id: "sample-p4-reply", postId: "p4", author: "dretracks", parentId: "sample-p4", body: "Warm and understated, with room for harmonies." },
  { id: "sample-p5", postId: "p5", author: "lyrick", body: "Bringing a new verse to the demo showdown." },
  { id: "sample-p6", postId: "p6", author: "kayobeats", body: "The swing works. I'd pull the hats back just a little." },
  { id: "sample-p7", postId: "p7", author: "judgeraye", body: "Absolutely. Listening for arrangement makes every second feel intentional." },
];
export const commentCount = (p: LobbyPost, state: LobbyState) => p.comments + state.comments.filter((c) => c.postId === p.id).length;
const topicQueries: Record<string, string> = { "Mixing Tips": "mix", "Collab Requests": "", "16-Bar Challenge": "verse", "Beat Feedback": "", "Studio Setup": "chain", "Lyric Writing": "writing", "Upcoming Battles": "battle" };
export const topicFilter = (topic: string): { query: string; category: PostCat | "All" } => ({ query: topicQueries[topic] ?? topic, category: topic === "Collab Requests" ? "Collabs" : topic === "Beat Feedback" ? "Feedback" : "All" });
export function selectPosts(state: LobbyState, category: string, query: string, popular: boolean, savedOnly = false) {
  return [...state.posts, ...posts].filter((p) => (category === "All" || p.cat === category) && (!savedOnly || state.saved.includes(p.id)) && `${p.body} ${p.cat} ${people.find((a) => a.id === p.author)?.name ?? ""} ${p.audio?.title ?? ""} ${(p as LobbyPost).collaborator ?? ""} ${(p as LobbyPost).style ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => popular ? (b.likes + Number(state.liked.includes(b.id))) - (a.likes + Number(state.liked.includes(a.id))) : 0);
}