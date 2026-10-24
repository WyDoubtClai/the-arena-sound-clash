import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Heart, Image, MessageCircle, Mic, Search, Send, Share2, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { byId, me, people, tracks, beats, type PostCat } from "@/lib/data";
import { AudioEmbed, Avatar, Panel, PageHeader, Pills, RoleBadge } from "@/components/arena/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cleanBody, commentCount, emptyLobby, readLobby, sampleComments, selectPosts, STORAGE_KEY, toggleId, topicFilter, type Comment, type LobbyPost, type LobbyState } from "@/lib/lobby-demo";
import { trendingTopics } from "@/lib/data";

export const Route = createFileRoute("/lobby")({
  head: () => ({ meta: [
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { title: "The Lobby — The Arena" },
    { name: "description", content: "Explore demo music conversations, collaboration requests and audio previews in The Arena's Lobby." },
    { property: "og:title", content: "The Lobby — The Arena" },
    { property: "og:description", content: "Music-focused demo discussions, feedback, collaborations and local conversations." },
  ] }), component: Lobby,
});
const cats = ["All", "Discussions", "Questions", "Collabs", "Battles", "Feedback"] as const;
const previewAudio = [...tracks.map((t) => ({ id: t.id, title: t.title, seed: t.seed })), ...beats.map((b) => ({ id: b.id, title: b.title, seed: b.seed }))];
const field = "w-full min-w-0 rounded-lg border bg-background p-3 text-sm outline-none focus:border-violet";

function AuthorName({ id }: { id: string }) {
  const p = byId(id);
  // The profile page currently opens Blaze only; other creators must not link to it.
  return id === me.id ? <Link to="/profile" className="font-semibold hover:text-violet">{p.name}</Link> : <span className="font-semibold" title="Profile destination unavailable in this demo">{p.name}</span>;
}
function Lobby() {
  const [state, setState] = useState<LobbyState>(emptyLobby);
  const [loaded, setLoaded] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [cat, setCat] = useState<(typeof cats)[number]>("All");
  const [postCat, setPostCat] = useState<PostCat>("Discussions");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [popular, setPopular] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [collaborator, setCollaborator] = useState("");
  const [style, setStyle] = useState("");
  const [audioPicker, setAudioPicker] = useState(false);
  const [audioId, setAudioId] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  useEffect(() => {
    try { setState(readLobby(localStorage.getItem(STORAGE_KEY))); } catch { setStorageFailed(true); }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { setStorageFailed(true); }
  }, [state, loaded]);
  const shown = selectPosts(state, cat, query, popular, savedOnly);
  const active = selectPosts(state, "All", "", false).find((p) => p.id === activeId);
  const conversation = active ? [...sampleComments, ...state.comments].filter((c) => c.postId === active.id) : [];
  const toggle = (key: "liked" | "saved" | "following" | "commentLikes", id: string) => setState((s) => ({ ...s, [key]: toggleId(s[key], id) }));
  const openConversation = (id: string) => { setActiveId(id); setReplyTo(null); setCommentText(""); };
  const share = async (id: string) => {
    const url = `${window.location.origin}/lobby#${encodeURIComponent(id)}`;
    try { await navigator.clipboard.writeText(url); toast.success("Lobby link copied. Local posts are visible only in this browser."); }
    catch { toast.error("Couldn't copy the link. You can share the Lobby page address."); }
  };
  useEffect(() => {
    if (!loaded) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && selectPosts(state, "All", "", false).some((p) => p.id === id)) setActiveId(id);
    // Read the shared link once after stored posts are restored.
  }, [loaded]);
  const card = (p: LobbyPost, inDiscussion = false) => <PostCard key={p.id} p={p} liked={state.liked.includes(p.id)} saved={state.saved.includes(p.id)} count={commentCount(p, state)} onLike={() => toggle("liked", p.id)} onSave={() => toggle("saved", p.id)} onShare={() => share(p.id)} onComments={() => openConversation(p.id)} inDiscussion={inDiscussion} />;
  const renderComment = (c: Comment, isReply = false) => <div key={c.id} className={cn("flex gap-2 py-3", isReply && "ml-5 border-l pl-3")}>
    <Avatar id={c.author} size={28} />
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 text-xs"><AuthorName id={c.author} /><span className="text-muted-foreground">{c.createdAt ? "Local demo · " + new Date(c.createdAt).toLocaleString() : "Sample comment"}</span></div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{c.body}</p>
      <div className="flex gap-2"><Button size="sm" variant="ghost" aria-label={`Like comment by ${byId(c.author).name}`} aria-pressed={state.commentLikes.includes(c.id)} onClick={() => toggle("commentLikes", c.id)} className={cn("h-7 px-1 text-muted-foreground", state.commentLikes.includes(c.id) && "text-coral")}><Heart className={cn(state.commentLikes.includes(c.id) && "fill-current")} />{Number(state.commentLikes.includes(c.id))}</Button>
        <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => { setReplyTo(c); setCommentText(""); }}>Reply</Button></div>
    </div>
  </div>;
  return <div className="space-y-6">
    <PageHeader title="The Lobby" sub="Where the community talks music."><span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">Demo community · local interactions</span></PageHeader>
    {storageFailed && <p role="status" className="text-sm text-gold">Browser storage is unavailable. Changes will last only while this page is open.</p>}
    <Pills items={cats} value={cat} onChange={setCat} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        <Panel>
          <form className="flex gap-3" onSubmit={(e) => {
            e.preventDefault(); const body = cleanBody(text);
            if (!body) { toast.error("Write something before posting."); return; }
            const audio = previewAudio.find((a) => a.id === audioId);
            const post: LobbyPost = { id: crypto.randomUUID(), author: me.id, cat: postCat, time: "Local demo", createdAt: Date.now(), body, likes: 0, comments: 0, ...(audio ? { audio: { title: audio.title, seed: audio.seed } } : {}), ...(postCat === "Collabs" ? { collaborator: collaborator.trim(), style: style.trim() } : {}) };
            setState((s) => ({ ...s, posts: [post, ...s.posts] }));
            setText(""); setAudioId(""); setCollaborator(""); setStyle(""); setQuery(""); setSavedOnly(false); setPopular(false); setCat(postCat); toast.success("Demo post added");
          }}>
            <Avatar id={me.id} />
            <div className="min-w-0 flex-1 space-y-3">
              <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Write a post" rows={3} placeholder="What's on your mind?" className={cn(field, "resize-y")} />
              <div className="flex flex-wrap items-center gap-2"><label className="text-xs text-muted-foreground" htmlFor="post-category">Category</label><select id="post-category" value={postCat} onChange={(e) => setPostCat(e.target.value as PostCat)} className="min-w-0 rounded-md border bg-background p-2 text-xs">{cats.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}</select></div>
              {postCat === "Collabs" && <div className="grid gap-2 sm:grid-cols-2"><input aria-label="Collaborator needed" value={collaborator} onChange={(e) => setCollaborator(e.target.value)} placeholder="Collaborator needed (optional)" className={field} /><input aria-label="Musical style" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Genre / style (optional)" className={field} /></div>}
              {audioId && <div className="flex items-center gap-2 text-xs text-teal"><Mic />{previewAudio.find((a) => a.id === audioId)?.title}<Button type="button" variant="ghost" size="icon" aria-label="Remove audio preview" onClick={() => setAudioId("")}><X /></Button></div>}
              <div className="flex flex-wrap items-center gap-1"><Button type="button" variant="ghost" size="sm" disabled title="Photo uploads are a future feature"><Image />Photo · future</Button><Button type="button" variant="ghost" size="sm" onClick={() => setAudioPicker(true)}><Mic />Demo audio</Button><Button type="submit" size="sm" className="ml-auto" disabled={!loaded || !text.trim()}><Send />Post</Button></div>
            </div>
          </form>
        </Panel>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search conversations" placeholder="Search conversations" className={cn(field, "pl-9")} /></div>
          <select aria-label="Sort feed" value={popular ? "Popular" : "Recent"} onChange={(e) => setPopular(e.target.value === "Popular")} className="rounded-lg border bg-background p-3 text-sm"><option>Recent</option><option>Popular</option></select>
          <Button variant={savedOnly ? "secondary" : "ghost"} size="icon" title="Saved posts" aria-label="Show saved posts" aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}><Bookmark /></Button>
          {(query || savedOnly) && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setSavedOnly(false); }}>Clear</Button>}
        </div>
        {shown.map((p) => card(p))}
        {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No conversations match these filters.</p>}
      </div>
      <aside className="space-y-4">
        <Panel><h3 className="mb-3 font-semibold">Trending Topics <span className="text-xs font-normal text-muted-foreground">· demo</span></h3><ol className="space-y-1 text-sm">{trendingTopics.map((t, i) => <li key={t}><Button variant="ghost" className="h-auto w-full justify-start px-1 py-2 text-sm" onClick={() => { const f = topicFilter(t); setCat(f.category); setQuery(f.query); setSavedOnly(false); }}><span className="w-4 text-muted-foreground">{i + 1}</span>{t}</Button></li>)}</ol></Panel>
        <Panel><h3 className="mb-3 font-semibold">Suggested People <span className="text-xs font-normal text-muted-foreground">· demo</span></h3><div className="space-y-3">{people.slice(4, 9).map((u) => <div key={u.id} className="flex items-center gap-3"><Avatar id={u.id} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.role} · profile preview only</p></div><Button size="sm" variant={state.following.includes(u.id) ? "outline" : "default"} aria-label={`${state.following.includes(u.id) ? "Unfollow" : "Follow"} ${u.name}`} aria-pressed={state.following.includes(u.id)} onClick={() => toggle("following", u.id)}>{state.following.includes(u.id) ? "Following" : "Follow"}</Button></div>)}</div></Panel>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 px-2 text-sm text-violet" aria-label="Explore the Arena"><Link to="/compete">Battles</Link><Link to="/crate">The Crate</Link><Link to="/discover">Discover</Link><Link to="/profile">My demo profile</Link></nav>
      </aside>
    </div>
    <Dialog open={audioPicker} onOpenChange={setAudioPicker}><DialogContent className="max-h-[80dvh] w-[calc(100%-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>Choose a demo audio preview</DialogTitle><DialogDescription>Existing sample tracks and beats only. Real audio uploads are a future feature.</DialogDescription></DialogHeader><div className="space-y-1">{previewAudio.map((a) => <Button key={a.id} variant="ghost" className="w-full justify-start" onClick={() => { setAudioId(a.id); setAudioPicker(false); }}><Mic />{a.title}</Button>)}</div></DialogContent></Dialog>
    <Dialog open={!!active} onOpenChange={(open) => { if (!open) { setActiveId(null); setReplyTo(null); } }}><DialogContent className="flex max-h-[85dvh] w-[calc(100%-1rem)] max-w-2xl flex-col gap-3 overflow-hidden p-4 sm:p-6"><DialogHeader className="shrink-0 pr-6"><DialogTitle>Conversation</DialogTitle><DialogDescription>Demo discussion · no messages, XP or reputation awarded.</DialogDescription></DialogHeader>
      {active && <><div className="min-h-0 space-y-3 overflow-y-auto">{card(active, true)}<p className="text-xs text-muted-foreground">{commentCount(active, state)} comments{active.comments > 0 && " · Selected sample comments shown; original counts are demo totals."}</p><div className="divide-y">{conversation.filter((c) => !c.parentId).map((c) => <div key={c.id}>{renderComment(c)}{conversation.filter((r) => r.parentId === c.id).map((r) => renderComment(r, true))}</div>)}</div>{conversation.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}</div>
      <form className="shrink-0 space-y-2 border-t pt-3" onSubmit={(e) => { e.preventDefault(); const body = cleanBody(commentText); if (!body) return; const c: Comment = { id: crypto.randomUUID(), postId: active.id, author: me.id, body, createdAt: Date.now(), ...(replyTo ? { parentId: replyTo.parentId ?? replyTo.id } : {}) }; setState((s) => ({ ...s, comments: [...s.comments, c] })); setCommentText(""); setReplyTo(null); }}>
        {replyTo && <div className="flex items-center justify-between text-xs text-teal">Replying to {byId(replyTo.author).name}<Button type="button" variant="ghost" size="icon" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X /></Button></div>}
        <textarea aria-label={replyTo ? "Write a reply" : "Write a comment"} placeholder={replyTo ? "Write a reply…" : "Join the conversation…"} className={cn(field, "resize-none")} rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
        <div className="flex justify-end"><Button size="sm" disabled={!commentText.trim()}><Send />{replyTo ? "Send reply" : "Comment"}</Button></div>
      </form></>}
    </DialogContent></Dialog>
  </div>;
}
function PostCard({ p, liked, saved, count, onLike, onSave, onShare, onComments, inDiscussion }: { p: LobbyPost; liked: boolean; saved: boolean; count: number; onLike: () => void; onSave: () => void; onShare: () => void; onComments: () => void; inDiscussion: boolean }) {
  const a = byId(p.author);
  return <Panel className={cn("space-y-3", p.cat === "Collabs" && "border-teal/40")}>
    <div className="flex items-start gap-3"><Avatar id={a.id} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><AuthorName id={a.id} /><RoleBadge role={a.role} /><span className="text-xs text-muted-foreground">Lv {a.level}</span></div><p className="mt-1 text-xs text-muted-foreground">{p.createdAt ? "Local demo · " + new Date(p.createdAt).toLocaleString() : `Sample post · ${p.time}`}</p></div><span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px]", p.cat === "Collabs" ? "border-teal/40 text-teal" : "border-violet/40 text-violet")}>{p.cat}</span></div>
    {p.cat === "Collabs" && <div className="flex flex-wrap items-center gap-2 text-xs text-teal"><Users className="h-4 w-4" />Collaboration request{p.collaborator && <span>· {p.collaborator}</span>}{p.style && <span>· {p.style}</span>}</div>}
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{p.body}</p>
    {p.audio && <AudioEmbed track={{ id: p.id, title: p.audio.title, artist: a.name, seed: p.audio.seed }} />}
    {p.cat === "Collabs" && <p className="text-xs text-muted-foreground">Express interest in the conversation. Direct messaging is a future feature.</p>}
    <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><Button size="sm" variant="ghost" aria-label={`Like post by ${a.name}`} aria-pressed={liked} onClick={onLike} className={cn(liked && "text-coral")}><Heart className={cn(liked && "fill-current")} />{p.likes + Number(liked)}</Button><Button size="sm" variant="ghost" aria-label={`Open conversation: ${p.body.slice(0, 40)}`} onClick={onComments} disabled={inDiscussion}><MessageCircle />{count}</Button><Button size="sm" variant="ghost" onClick={onShare}><Share2 /><span className="hidden sm:inline">Share</span></Button><Button size="icon" variant="ghost" aria-label={saved ? "Unsave post" : "Save post"} aria-pressed={saved} onClick={onSave} className={cn("ml-auto", saved && "text-gold")}><Bookmark className={cn(saved && "fill-current")} /></Button></div>
  </Panel>;
}
