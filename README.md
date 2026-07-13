# 🏕️ Workshop

Run brand workshops everyone actually enjoys. A real-time, in-room workshop app — FigJam energy, Mentimeter mechanics, your agenda.

Everyone's laptop stays on the same question. People answer on their own screens, the projector shows the room's progress, and when everyone's in, the host reveals the results — word clouds, sticky-note walls, sliders, dot votes, moodboards. Every answer is saved forever and exports to Markdown or CSV.

## How it works in the room

| Screen | URL | Who |
|---|---|---|
| Join + answer | `/{CODE}` | everyone (QR on the projector) |
| Host console | `/host/{CODE}` | you — controls, who-has-answered HUD, presenter notes, scratchpad |
| Stage | `/stage/{CODE}` | the projector — giant type, progress, reveals, emoji rain |
| Editor | `/edit/{CODE}` | authoring sections + questions ahead of time |
| Recap | `/recap/{CODE}` | afterwards — every result + exports, forever |

**Question types:** multiple choice · open answer · post-its (categorized, draggable between columns) · slider · inspo board (paste links or Cmd-V screenshots) · word cloud · dot vote · ranking · **slides** (intro/outro/dividers) · **discussion** (talk it out; the host scratchpad is the record).

**Feel:** everything springs and pops — question transitions, reveals, dots, badges, sticky notes — with zero audio (it's a quiet room). New rooms open with a welcome slide and close with an outro slide, wrapped around the house question set.

**The flow:** everyone answers → answered folks see "waiting on the group" with live progress → the moment the last person's in, every screen pops confetti and the host's Reveal button lights up → host reveals, discusses, advances. Auto-reveal is a toggle. Late arrivals scan the QR and land on the current question; counts update instantly. Anyone can react with emoji any time — they float up every screen in the room, YouTube-Live style.

## Stack (deliberately boring, deliberately Netlify)

- **Vite + React SPA** on the CDN — no SSR to fail during a client meeting.
- **One Netlify Edge Function** (`netlify/edge-functions/api.ts`) — the whole backend.
- **Netlify Blobs** (strong consistency) — the whole database. No external services, no keys.
- **Real-time = Server-Sent Events** from the edge function (Netlify's officially supported streaming pattern). Clients auto-reconnect, and if a hostile venue proxy blocks SSE entirely, they silently fall back to 1.2s polling of the same snapshot endpoint. Every push is the *complete* room state, so a dropped message can never desync anyone.
- **Write model:** every writer owns its own blob key (participant, answer, emote) — zero write contention; a tiny `version` blob is bumped on every mutation and is all the sync loops watch. Snapshot computation is memoized per isolate, so a room full of screens shares one recompute.

## Develop

```bash
npm install
netlify dev        # app + edge functions + local blobs at http://localhost:8888
npm test           # vitest on the shared core (aggregation, exports, presence, sanitizing)
npm run build      # typecheck + production build
```

## Deploy

```bash
netlify deploy --build --prod
```

That's it — no environment variables, no database provisioning. Blobs and edge functions are wired up by the platform. (First time: `netlify init` to create/link the site.)

## Repeatability

Any room can be **duplicated as a template** (from the editor or the recap) — build your master branding-workshop room once, clone it per client. New rooms are pre-seeded with a complete example workshop so you can feel the tool in 30 seconds.
