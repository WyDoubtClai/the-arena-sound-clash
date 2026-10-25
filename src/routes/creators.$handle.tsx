import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { accountRequest, type CreatorProfile } from "@/lib/account";
import { PublicCreator } from "@/components/arena/account-profile";

export const Route = createFileRoute("/creators/$handle")({ component: CreatorPage });
function CreatorPage() {
  const { handle } = Route.useParams();
  const [state, setState] = useState<{ handle: string; profile?: CreatorProfile; error?: string } | null>(null);
  useEffect(() => {
    let active = true;
    accountRequest<{ profile: CreatorProfile }>(undefined, handle).then(({ profile }) => { if (active) setState({ handle, profile }); })
      .catch((e: Error) => { if (active) setState({ handle, error: e.message }); });
    return () => { active = false; };
  }, [handle]);
  return <div className="mx-auto max-w-xl space-y-4">{state?.handle !== handle ? <p role="status">Loading creator…</p> : state.error ? <p role="alert">{state.error}</p> : state.profile && <PublicCreator profile={state.profile} />}<Link to="/account" className="text-violet">Your account and Settings →</Link></div>;
}
