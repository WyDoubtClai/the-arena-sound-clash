<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep Crate browsing and artist competition on separate routes using the same beat dataset, so discovery never enters a battle.
- Share participant, countdown and scoring controls between artist and producer demos; preserve producer-specific stages and rules.
- Artist demo voting uses seeded draws and a documented simulated ballot; keep the simulation reproducible and testable.
- Artist audio uses the shared player with optional segment bounds so previews and judging never overlap.
- Artist battle formats share one upload window whose single close (all eight submitted or timer zero) decides the judged entries; downloads slice the cached render the player streams so preview and file match.
- Keep profile demo fixtures and owner/showcase eligibility in a browser-safe profile module; this makes role separation and local control rules testable without changing battle engines.
- Keep Lobby demo state and selection/count helpers in a browser-safe module, persisting only local additions and interactions after hydration; this preserves seeded content and avoids changing progression or backend systems.
