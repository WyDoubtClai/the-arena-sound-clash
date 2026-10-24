import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, Heart, Image, MessageCircle, Mic, Send, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { byId, me, people, posts as seed, trendingTopics, type Post } from "@/lib/data";
import { AudioEmbed, Avatar, Panel, PageHeader, Pills, RoleBadge } from "@/components/arena/bits";

export const Route = createFileRoute("/lobby")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "The Lobby — The Arena" },
      { name: "description", content: "Music community feed: discussions, questions, collabs, battle talk and feedback." },
      { property: "og:title", content: "The Lobby — The Arena" },
      { property: "og:description", content: "Music community feed: discussions, questions, collabs, battle talk and feedback." },
    ],
  }),
  component: Lobby,
});

const cats = ["All", "Discussions", "Questions", "Collabs", "Battles", "Feedback"] as const;

function Lobby() {
  const [cat, setCat] = useState<(typeof cats)[number]>("All");
  const [list, setList] = useState<Post[]>(seed);
  const [text, setText] = useState("");
  const shown = list.filter((p) => cat === "All" || p.cat === cat);
  return (
    <div className="space-y-6">
      <PageHeader title="The Lobby" sub="Where the community talks music." />
      <Pills items={cats} value={cat} onChange={setCat} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Panel>
            <form className="flex gap-3" onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              setList([{ id: crypto.randomUUID(), author: me.id, cat: cat === "All" ? "Discussions" : cat, time: "now", body: text, likes: 0, comments: 0 }, ...list]);
              setText("");
              toast.success("Posted to The Lobby");
            }}>
              <Avatar id={me.id} />
              <div className="flex-1 space-y-3">
                <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Write a post" rows={2} placeholder="What's on your mind?" className="w-full resize-none rounded-xl border bg-background p-3 text-sm outline-none focus:border-violet" />
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Image className="h-4 w-4" /> Photo</span>
                  <span className="flex items-center gap-1"><Mic className="h-4 w-4" /> Audio</span>
                  <button type="submit" className="ml-auto flex items-center gap-1 rounded-lg bg-violet px-3 py-1.5 font-semibold text-primary-foreground"><Send className="h-3 w-3" /> Post</button>
                </div>
              </div>
            </form>
          </Panel>
          {shown.map((p) => <PostCard key={p.id} p={p} />)}
          {shown.length === 0 && <p className="text-center text-sm text-muted-foreground">No posts here yet.</p>}
        </div>
        <aside className="space-y-4">
          <Panel>
            <h3 className="mb-3 font-semibold">Trending Topics</h3>
            <ol className="space-y-2 text-sm">{trendingTopics.map((t, i) => <li key={t} className="flex gap-3"><span className="text-muted-foreground">{i + 1}</span>{t}</li>)}</ol>
          </Panel>
          <Panel>
            <h3 className="mb-3 font-semibold">Suggested People</h3>
            <div className="space-y-3">{people.slice(4, 9).map((u) => <Suggest key={u.id} id={u.id} />)}</div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Suggest({ id }: { id: string }) {
  const [f, setF] = useState(false);
  const u = byId(id);
  return (
    <div className="flex items-center gap-3">
      <Avatar id={id} size={32} />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.role}</p></div>
      <button onClick={() => setF(!f)} className={cn("rounded-md px-3 py-1 text-xs font-semibold", f ? "border text-muted-foreground" : "bg-violet text-primary-foreground")}>{f ? "Following" : "Follow"}</button>
    </div>
  );
}

function PostCard({ p }: { p: Post }) {
  const a = byId(p.author);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <Panel className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar id={a.id} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{a.name}</span><RoleBadge role={a.role} /><span className="text-xs text-muted-foreground">Lv {a.level} · {p.time}</span></div>
        </div>
        <span className="rounded-full border border-violet/40 px-2 py-0.5 text-[10px] text-violet">{p.cat}</span>
      </div>
      <p className="text-sm">{p.body}</p>
      {p.audio && <AudioEmbed track={{ id: p.id, title: p.audio.title, artist: a.name, seed: p.audio.seed }} />}
      <div className="flex items-center gap-5 text-sm text-muted-foreground">
        <button aria-pressed={liked} onClick={() => setLiked(!liked)} className={cn("flex items-center gap-1", liked && "text-coral")}><Heart className={cn("h-4 w-4", liked && "fill-current")} />{p.likes + (liked ? 1 : 0)}</button>
        <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" />{p.comments}</span>
        <button onClick={() => toast("Link copied")} className="flex items-center gap-1"><Share2 className="h-4 w-4" />Share</button>
        <button aria-label="Bookmark" aria-pressed={saved} onClick={() => setSaved(!saved)} className={cn("ml-auto", saved && "text-gold")}><Bookmark className={cn("h-4 w-4", saved && "fill-current")} /></button>
      </div>
    </Panel>
  );
}
