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
