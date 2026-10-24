# The Arena: Sound Clash

Build Phase 1 of THE ARENA: Design Foundation, Navigation & Interactive Prototype.

The Arena is a social music network combined with a competitive music gaming platform.
Follow the visual mockups and blueprint strictly:
- Obsidian Background: #0D0D14
- Secondary Surfaces: #1A1926
- Arena Violet: #9D70FF
- Battle Coral: #FF6B61
- Champion Gold: #F3C969
- Community Teal: #59D7C4
- Main Text: #F8F6FF
- Fonts: Space Grotesk for headings, Inter for body/UI.

Deliverables in this interactive frontend prototype:
1. Application Shell:
- Premium desktop sidebar navigation and responsive 5-tab mobile bottom navigation (Home, Lobby, Compete, Discover, Profile; with Gauntlet, Crate, Events, Rankings accessible).
- Global search, notification preview, quick 'Create' action, profile badge avatar.
- Persistent global bottom music player (plays demo audio with waveform, play/pause, seek, volume, track details, persists across route changes, auto-pauses when entering a live battle audio session).

2. Home Screen:
- Hero banner (Featured live Gauntlet / Friday Night Song Battle), upcoming battles slider, trending Lobby discussions, featured artists & producers, rising Crate beat highlights, live activity ticker.

3. The Lobby:
- Music-focused community feed with categories (All, Discussions, Questions, Collabs, Battles, Feedback).
- Interactive post cards with role badges (Artist, Producer, Engineer, Judge, Listener), audio embeds with waveform/play, comment count, likes, bookmarks.
- Working filter buttons and local reaction toggles.

4. Compete Hub:
- Cards for Producer Quick Battle (8 producers, 15 min + 3 min upload, 45s beat), Artist Quick Battle (Crate draw, 15 min create, 60s entry), Custom Battle Rooms (up to 20, performers/judges), and Song-for-Song battles (1-8 songs).
- Direct entry button launching the live Gauntlet simulator.

5. The Gauntlet (Interactive Live Producer Quick Battle Simulator):
- 8-participant live battle room featuring all stages:
  a. Waiting Room / Ready Up
  b. Sample Kit Reveal & Download
  c. 15-Minute Creation Countdown
  d. 3-Minute Upload Window with drag-and-drop beat entry simulation
  e. Live Synchronized Listening & Judging (round-robin through the 8 beats, synchronized waveform/time, 1-5 star rating where your own entry disables voting, 10 live floating emoji bursts, live chat box)
  f. Final Results Podium (1st-8th rankings, average ratings, XP rewards preview).
- Include an accelerated 'Demo Mode' toggle / fast-forward buttons so all stages can be tested in seconds without waiting 18 minutes.

6. The Crate (Instrumental Library & Crate Draw Simulator):
- Browse beats with title, producer, genre, BPM, key, duration, 60s competition segment tag, and giveaway badge.
- Upload beat modal concept showing 60s wave segment selector, metadata, and rolling upload allowance card (3/24h, 10/7d, 30 active).
- Interactive Crate Draw Demo: 4 fictional instrumentals displayed, user auditions snippets, votes for one, and triggers simulated reveal.

7. Supporting Views:
- Discover (trending tracks, rising producers, genre pills).
- Events (scheduled battles with countdowns, participant rosters, register button).
- Rankings (leaderboards for artists, producers, judges, XP progression vs community reputation).
- Profile (Blaze / ToneMadelt layout from mockups: stats, identity badges, music discography, battle record W/L/D, and producer exposure stats: draws, picks, battle wins).

Make the entire prototype responsive, accessible, beautifully styled in dark neon aesthetic, with realistic demo data and rich local interactions.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/940eca12-a9fd-42a9-a759-be14edf8fd65).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
