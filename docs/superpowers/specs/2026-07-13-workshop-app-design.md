# Workshop — live branding-workshop app · Design spec

**Date:** 2026-07-13 · **Status:** implemented in this session; decisions documented here for review.

A real-time web app for running two-day, in-person branding workshops with startup clients. FigJam/Miro energy: big type, sticky notes, floating emoji, zero friction. Everyone in the room stays on the same question; the host runs the show; every answer is saved and exportable.

## 1. The room model

- A **room** = one workshop. Created ahead of time by the host, has a name, a 4-letter join code, and an ordered list of **sections**, each holding ordered **questions**.
- Unique URLs per room. Participants join at `/{CODE}` (also shown as a QR code on the projector). Joining mid-workshop (after lunch) is first-class: you land on the current question immediately, and counts/results reflect you instantly.
- No accounts. The host holds a secret **host key** (embedded in the host URL and kept in localStorage). All host-only actions require it. Participants get a random participant id stored per-room in localStorage, so a page refresh keeps their identity and answers.

### Roles / views

| Route | Who | What |
|---|---|---|
| `/` | host | Create a room, see rooms on this device |
| `/edit/:code` | host (key) | Author sections + questions, per-question presenter notes, settings |
| `/:code` | participant | Join (name + emoji avatar), then the live question view |
| `/host/:code` | host (key) | Question controls + who-has-answered HUD + notes + scratchpad + timer |
| `/stage/:code` | projector | Read-only big-type view: question, live answer count, revealed results, QR code, emoji rain |
| `/recap/:code` | anyone with code | Full results of every question + Markdown/CSV export + fun stats |

The projector gets its **own view** (not the host's laptop mirrored) because the host screen carries private notes and the HUD.

## 2. Real-time architecture (the "bulletproof on Netlify" part)

Netlify has no WebSockets. The Netlify-native real-time pattern — officially documented and exemplified — is **Edge Functions streaming Server-Sent Events**: the 50ms CPU budget excludes time spent waiting, so a long-lived SSE stream that wakes briefly on a timer is explicitly supported. Storage is **Netlify Blobs** with **strong consistency** reads (immediate read-after-write). No external services, no API keys, nothing else to fail.

```
participant/host/stage clients
   │  POST /api/rooms/:code/{join,answer,emote,heartbeat,host,...}   (writes → Blobs, bump version)
   │  GET  /api/rooms/:code/sync?sse=1                               (SSE stream)
   ▼
one edge function (api.ts) ── @netlify/blobs (strong consistency)
```

**Sync loop:** every client holds an SSE connection. The edge function polls one tiny `version` blob (~350ms cadence — cheap single read). When the version changes (any join/answer/host action/emote), it recomputes the full room snapshot from Blobs and pushes it. It also pushes on a slow heartbeat (~5s) so presence counts stay fresh without version churn from heartbeats.

**Why this is bulletproof for a conference room:**

1. **EventSource auto-reconnects.** If the venue proxy or Netlify cuts a stream, the browser reconnects transparently; the next push carries the complete snapshot (not deltas), so a dropped message can never desync anyone. Snapshots are idempotent by design.
2. **Polling fallback.** If SSE won't establish at all (hostile hotel WiFi), the client silently falls back to fetching the same snapshot endpoint (`?once=1`) every ~1.2s. Same payload, same code path, slightly higher latency, zero functional difference.
3. **No write contention.** Every writer owns its own blob key: each participant writes `participants/{pid}` and `answers/{qid}/{pid}`; only the host writes `state`. Concurrent answers can never clobber each other. The only shared key is `version`, and it's last-write-wins by design (any bump triggers recompute-from-truth).
4. **Self-healing presence.** "In the room" = heartbeat within the last ~25s (plus an instant `leave` beacon on tab close). A closed laptop drops out of the count automatically, so "waiting on everyone" can never stall on a ghost; the host can also manually remove anyone from the HUD.
5. **In-isolate memoization.** Snapshot computation is memoized per room version, so 20 SSE connections sharing an isolate do one recompute, not 20. Blob traffic at rest is ~2 tiny reads/sec/client.

Latency budget: action → blob write (~50–150ms) → next poll tick (≤350ms) → push. Under a second, every time, at in-room scale (5–40 people).

**Payload shaping by role.** Before a reveal, participants receive only *who* has answered (for the waiting screen), never values. The host always sees values. After reveal, everyone gets values. Questions marked **anonymous** strip author attribution for non-host viewers even after reveal, and the waiting screen shows only counts (not who's pending). The host key never leaves the server in any snapshot.

## 3. Data model (Netlify Blobs, store `workshop`)

```
rooms/{code}/config                 room name, settings, sections[questions[]], hostKey, presenter notes
rooms/{code}/state                  { phase, current {section,question}, revealed{qid}, timer, startedAt, endedAt }
rooms/{code}/participants/{pid}     { pid, name, avatar, joinedAt, lastSeen, removed? }
rooms/{code}/answers/{qid}/{pid}    { pid, value, updatedAt }        (value shape varies by type)
rooms/{code}/events/{ts}-{rand}     emote events (kept for fun end-of-session stats)
rooms/{code}/scratch                host scratchpad { text, updatedAt }
rooms/{code}/uploads/{id}           pasted inspo images (bytes, capped 5MB, image/* only)
rooms/{code}/version                tiny string; bumped after every meaningful write
```

Everything is archived by construction — the recap page and exports read the same blobs forever. Deleting a room is an explicit host action.

**Phases:** `lobby → live ⇄ break → ended`. Within `live`, a question is *open* (accepting answers) or *revealed*. Answers stay editable while a question is open **and** after reveal — a late joiner can answer a revealed question and the results update live in front of everyone (which is a feature, not a bug: "the results instantly reflect the new person").

**Flow per question:** everyone answers → answered participants see a "waiting on the group" screen with live progress → when the last online participant answers, the host's Reveal button goes loud (and the room gets a little celebration) → **host chooses** when to reveal (optional per-room auto-reveal toggle) → host advances when discussion is done. Advancing is always manual — pacing belongs to the facilitator, and the host can navigate to any question, reopen a revealed one, or jump back.

## 4. Question types (8)

| Type | Participant does | Reveal shows |
|---|---|---|
| `choice` | Pick one (or several) predefined options | Horizontal bars with counts + voter avatars |
| `open` | Type a free answer | Card wall of answers |
| `postits` | Add multiple notes into host-defined categories (Good/Bad, Now/Next/Later…) | Sticky-note board grouped by category, notes tilted like real post-its |
| `slider` | Drag between two poles (Fun ↔ Corporate) | Every vote as a dot on the track + the group average |
| `inspo` | Paste image URLs / links / screenshots (clipboard paste uploads to Blobs) | Visual moodboard; links become site cards |
| `wordcloud` | Up to 3 short words | Word cloud sized by frequency |
| `dotvote` | Distribute N dots across options (classic workshop dot-voting) | Options ranked by dots with dot rows |
| `rank` | Tap items in priority order | Aggregate ranking (average position), medals on top 3 |

`wordcloud`, `dotvote`, and `rank` are my additions to the requested five — they're the three most-used physical workshop rituals not already covered (Mentimeter-style word clouds, sticker dot-voting, and priority ranking).

## 5. Delight features

- **Emoji reactions**: persistent quick-bar on participant screens; a tap floats the emoji + your name up everyone's screen (host, stage, participants), YouTube-Live style. Light rate-limit (client cooldown + server cap per second).
- **All-in celebration**: when the last person answers, every screen gets a small confetti pop; bigger confetti when a section completes.
- **Host timer**: one tap starts a countdown ("2:00 for post-its") rendered huge on the stage and on participant screens, synced via server timestamp (client clock-skew corrected).
- **QR join on stage**: the projector view always offers the room QR + code so late arrivals seat themselves.
- **Emoji avatars**: joiners pick name + animal emoji; avatars are the identity everywhere (HUD, waiting screen, voter chips).
- **Break screen**: host can flip the room to a "back at 1:30"-style break phase.
- **Warm host tools**: per-question presenter notes (authored ahead of time) + a live scratchpad, both in a dock across the bottom of the host view; scratchpad autosaves and lands in the export.
- **Session stats on recap**: total answers, reactions by emoji, most-reacted moment — a tiny "workshop wrapped".
- **Repeatability**: any room can be duplicated as a template for the next client.

## 6. Look & feel

Light, warm, poster-like — light backgrounds project far better than dark in a bright meeting room. Cream canvas, ink text, saturated accent set (coral, tangerine, sunny yellow, mint, sky, lilac), chunky rounded cards with offset shadows, sticky-notes with believable tilt. Motion everywhere but fast (question transitions, counters, emoji physics).

**Type (Google fonts, self-hosted via Fontsource so venue WiFi can't hurt us):**
- Display: **Bricolage Grotesque** — big, characterful, poster-grade
- UI/body: **Outfit** — friendly geometric sans
- Handwriting accent: **Caveat** — post-its and the scratchpad

## 7. Stack

- **Vite + React + TypeScript** SPA (no SSR — static shell on the CDN is the most bulletproof thing Netlify serves), react-router, Tailwind v4 + hand-rolled CSS for the fun, `motion` for animation, `qrcode` for stage QR.
- **One Netlify Edge Function** (`/api/*`) — router + SSE, Deno runtime.
- **Netlify Blobs** — storage, strong consistency.
- **Shared core** (`shared/`) imported by both client and edge function: types, aggregation, state transitions, presence rules, exports, codes. All unit-tested with vitest.
- Local dev + prod parity via `netlify dev` (runs edge functions in Deno + a local Blobs sandbox).

## 8. Exports

- **Markdown**: full session document — sections, questions, every answer grouped by type (post-its by category, slider stats, ranked lists), participant list, scratchpad, stats. Ready to paste into the client follow-up doc.
- **CSV**: one row per answer (`section, question, type, participant, value, detail, timestamp`) for spreadsheet people.
- Both generated on demand from Blobs at `/api/rooms/:code/export?format=md|csv`, downloadable from the recap page and the host view.

## 9. Error handling & edge cases

- Duplicate name joins get distinct avatars/ids; rejoining with the same browser resumes the same identity.
- Answer writes are per-participant keys — no lost updates; last edit wins per person.
- Reveal with zero answers is allowed (host may skip a question entirely).
- Host disconnect: room state lives server-side; host reopens the URL and is back; a co-facilitator can hold the same host link.
- Clock skew: timer countdowns computed against server time offset.
- Emote flood: server drops >5/s/participant.
- SSE cut mid-workshop: auto-reconnect < 2s; worst case, polling fallback continues seamlessly.

## 10. Addendum (same day): slides, discussions, the house deck, full motion

**Two new "talk" types** with no answer machinery (no waiting screen, no reveal, no HUD progress — the host just advances when the room's ready):

- `slide` — presentation moments: big emoji + title + body. Every new room opens with an intro slide and closes with an outro slide; hosts can drop dividers anywhere.
- `discuss` — a prompt the room talks through out loud. Participants get a "laptops half-mast" screen; the host scratchpad is the record, and the export says so.

**The default template is now the house question set**: intro slide → website goal (choice: gain customers / attract funding) → the brand honestly (post-its: does well / can do better) → fun ↔ corporate (slider) → what content will we make (discussion) → who has the best website (inspo) → champagne moment (open) → outro slide.

**Motion system**: one spring language (`src/lib/springs.ts` — POP/BOUNCE/SLIDE/SHIFT presets) across every interaction. Question-to-question transitions via AnimatePresence; staggered spring reveals on every results screen; whileTap/whileHover on every control; dots/badges/captions pop with springs. No audio anywhere — this runs in a quiet room. `prefers-reduced-motion` collapses all animation to instant, and no content ever *depends* on an animation playing to become visible.

**Draggable post-its**: on the input board, notes drag between category columns — dropping on the other column re-categorizes the note and saves (drop target = the note's own midpoint, not the pointer). On revealed boards (post-its, open-answer cards, inspo pins), everything is free-draggable *locally* so whoever drives the projector can cluster during discussion; those positions are play-space and don't sync or persist (a deliberate scope line — syncing host rearrangement of other people's answers is a v2 idea).

**Presence semantics tightened**: "in the room" now means the tab is actually visible. Hiding the tab (checking email) marks you away immediately — the room never waits on someone who isn't looking — and refocusing brings you back within a heartbeat.

## 11. Out of scope (v1)

- Auth/accounts, multi-team tenancy
- Free-form canvas (real FigJam) — we're a facilitated question flow, deliberately
- File uploads other than pasted inspo images
- Editing questions mid-session *while a question is open* (host can edit between questions; live-editing the open one risks answer mismatch)
