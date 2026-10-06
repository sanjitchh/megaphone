# Megaphone — Spec Sheet

> Status: **Draft v0.5** (2026-10-06) — items marked **[OPEN]** need a decision.
>
> Megaphone follows the technical decisions of the **Sentinel** project (`~/Desktop/City/sentinel`) unless stated otherwise. It does **not** reuse Sentinel's branding or infrastructure.
> "(Sentinel)" marks a decision inherited from there; references point to files in that repo.

## 1. Overview

Megaphone is a webinar platform. Admins create webinar rooms, configure them, and share a link. Anyone with the link can join the live session. Live audio/video is powered by self-hosted LiveKit.

**Key difference from Sentinel:** Sentinel is many-to-one (one proctor watches many student cameras) and shards each session into LiveKit rooms of ~20–28 people. Megaphone is one-to-many: one host (plus room admins sharing screens) broadcasts to up to 500 view-only students in a **single, unsharded LiveKit room**. Sentinel's shard sizes and grid patterns do not carry over.

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Language / framework | PHP 8.4, Laravel 13, slim skeleton (all wiring in `bootstrap/app.php`) (Sentinel) |
| Runtime | Laravel Octane (Swoole), Horizon for queues, Reverb for websockets (Sentinel) |
| Frontend | Inertia 2 + React 19, TypeScript (strict), Tailwind v4, Vite. Start from the current official Laravel React starter kit, not the older kit used by `sentinel-demo-lms`. |
| UI kit | shadcn/ui (`base-nova` style on Base UI), lucide-react icons, sonner toasts (Sentinel) |
| Forms | Inertia `useForm`, server-side validation via Form Requests |
| Real-time media | LiveKit server **v1.13.5**, self-hosted (Sentinel pin) |
| LiveKit server SDK | `agence104/livekit-server-sdk` ^1.3 (Sentinel locks 1.3.5) |
| LiveKit client SDK | `livekit-client` ^2.18 + `@livekit/components-react` ^2.9 (Sentinel proctor versions) |
| Database | MySQL 8 (Sentinel); production hosting TBD with infra |
| Cache / queue / sessions | Redis, split by DB number: 0 locks + Reverb, 1 cache, 2 sessions, 3 queue/Horizon (Sentinel) |
| Mail | Mailpit locally; production provider TBD with infra |
| Admin auth | Session-based auth from the starter kit (Fortify) + `spatie/laravel-permission` |

## 3. Roles

There are two kinds of roles: **team roles** say what an admin may do in the dashboard; **room roles** say what an admin does inside a particular room.

| Role | Kind | Description |
|---|---|---|
| **Super admin** | Team | Manages the admin team (invite/remove admins) plus everything an admin can do. |
| **Admin** | Team | Internal team member. Creates/configures rooms, generates links, and can be assigned to rooms. |
| **Host** | Room | **Exactly one per room.** The presenter: camera + mic are the main feed students see. Can share screen and moderate. |
| **Room admin** | Room | Any number per room. Admin team members who help run the session: share screen and moderate. Their camera is not shown to students. |
| **Student** | Room | Attendee. Joins via a room link as a guest with **name + email** (no account, no password). |

### 3.1 Admin permissions (Sentinel model)
- `spatie/laravel-permission` for team roles (`super_admin`, `admin`). Routes are gated on **permissions** (`rooms.create`, `admins.invite`, …), never on role names.
- `super_admin` bypasses checks via `Gate::before`.
- Room roles are per-room assignments, not spatie roles. The host is a single `rooms.host_id` column, so a room can only have one host. Room admins live on a `room_admins` pivot.
- The host can be reassigned to another admin; a room cannot go live without a host.
- Admins are invited by name + email + team role; the invitation link expires after 24h (Sentinel `ADMIN_INVITATION_TTL_HOURS`).
- **Single team.** No organisations or multi-tenancy; every admin belongs to the same team.

### 3.2 Students
- No cohorts or groups. As in Sentinel, students exist per room (attendance records), not as user accounts.

## 4. Core Features (MVP)

### 4.1 Room management (Admin)
- Create / edit / delete / archive webinar rooms.
- Fields: title, description, scheduled start/end, **max participants** (up to 200 or 500), the **host** (exactly one), and **room admins** (zero or more).
- Status lifecycle (Sentinel): `SCHEDULED → LIVE → ENDED | CANCELLED`. Scheduling fields are editable only while `SCHEDULED`.
- Generate shareable links per room (unguessable slug, e.g. `/r/{random-slug}`). A room can have several links.
- **Links expire.** Every link has an `expires_at` set by the admin when the link is created. The default is the room's scheduled end, and the admin can choose another time. Admins can extend, revoke or regenerate a link.
- An expired or revoked link shows a clear "This link has expired" page and issues no token.
- Rooms not ended manually are swept as ended after the scheduled end plus a grace period (Sentinel uses 2h).
- No room passwords and no lobby. Link expiry is the only access control beyond the unguessable slug.

### 4.2 Joining a room (Student)
- Open link → pre-join screen (display name + email, speaker check) → join.
- Name/email are stored for attendance. A returning email reuses the same guest record.
- Server issues a LiveKit access token with the correct grants.
- Join is refused when the room is full (`max_participants` enforced both in the app and on the LiveKit room).
- **Joinable any time** while the link is valid and the room is not `ENDED` / `CANCELLED`. There is no scheduled join window; the schedule is informational.
- Students who join before a host is broadcasting see a "Waiting for the host to start" state inside the room, and the stream starts automatically when the host goes live.

### 4.3 Live session
- **Webinar model**: the host publishes camera + mic; the host and room admins can share their screen; students are **subscribe-only** by default.
- **Screen share**:
  - Any member of the admin team in the room (host or room admin) can share their screen.
  - **One screen share at a time.** Starting a new share replaces the current one; the previous sharer's share is stopped.
  - The active screen share takes **centre stage** for every student.
- Moderation (host and room admins): mute/remove participants, promote/demote students, end the session for everyone. Mute uses `mutePublishedTrack` with `enable_remote_unmute: true` in `livekit.yaml` (Sentinel).
- **Raise hand** (MVP):
  - The student raises/lowers a hand over **Reverb** on a private per-student channel, as in Sentinel (`HandleProctorClientEvent` → queued job → `SessionStudentHandRaiseService`).
  - State is persisted with a row lock, written idempotently, and logged as a `HAND.RAISED` / `HAND.LOWERED` event.
  - The host and room admins see a queue ordered by time raised.
  - **New in Megaphone** (Sentinel never changes publish permissions): the host or a room admin promotes a student to speaker, which grants `canPublish` via LiveKit `UpdateParticipant`, and demotes them back.
  - Promoted students can publish **microphone and camera** (`canPublishSources: [microphone, camera]`; no screen share). Their tiles appear on stage next to the host's camera.
  - Promotion is capped by a stage limit to keep the subscriber fan-out bounded. The proposed default is 4 promoted students at once, configurable per room.
- Later (not MVP): chat, Q&A, polls, reactions, recording.

### 4.4 Student view (layout)
- **Centre stage**: the active screen share if there is one; otherwise the host's camera.
- **Side strip**:
  - the host's camera (when a screen share is on centre stage);
  - promoted students' cameras;
  - the student's **own camera** as a self-view.
- **Self-view is a local preview only.** It is captured in the browser and **not published** to LiveKit until the student is promoted. Being seen by 500 people has no server cost, and it makes the switch to speaking instant.
- The student can turn the self-view off (camera off) at any time.
- Students never see other (non-promoted) students' video.

### 4.5 Host / room admin view
- Stage preview (what students see), screen-share controls, raised-hand queue, participant list with moderation actions, live participant count.

### 4.6 Admin dashboard
- Room list with status and live participant counts.
- Per-room attendance log (who joined, when, how long), fed by LiveKit webhooks.

## 5. LiveKit Integration

- **Wrapper**: port Sentinel's `app/Services/LiveKit/LiveKitClient.php` and `TimeboxedRoomServiceClient.php` (room CRUD, tokens, mute, remove, list participants, `sendData`, Guzzle connect/request timeouts of 2s/3s), plus an `updateParticipantPermissions()` method.
- **Config** (`config/livekit.php`, Sentinel shape): `url` (internal, e.g. `http://livekit:7880`), `public_url` (`wss://…` for browsers), `api_key`, `api_secret`, `token_ttl` (3600), `room_empty_timeout` (300), timeouts.
- **Identity**: always a UUID (guest UUID or admin UUID); the participant name is the display name; the role goes in participant metadata `{role}`.
- **Grants by role**:
  - Host: `canPublish` (camera, microphone, screen share, screen-share audio), `canSubscribe`, `roomAdmin`.
  - Room admin: `canPublish` with `canPublishSources: [screen_share, screen_share_audio, microphone]`, `canSubscribe`, `roomAdmin`. No camera.
  - Student: `canPublish: false`, `canSubscribe: true`, `canPublishData: false` (hand-raise goes over Reverb).
  - Promoted student: `canPublish: true`, `canPublishSources: [microphone, camera]`.
- **Room creation**: one LiveKit room per webinar, with `maxParticipants` = room capacity + staff seats (1 host + the room admins). Because students can join any time, the room is created lazily on the first join (host or student) and recreated if LiveKit's `emptyTimeout` has closed it.
- **Webhooks**: `/webhooks/livekit` (signature-verified, processed on a `webhooks` queue) for `room_started`, `room_finished`, `participant_joined`, `participant_left`, `track_published`, `track_unpublished`. Sentinel has no inbound LiveKit webhooks and polls presence instead; Megaphone needs webhooks for accurate attendance.
- **Client settings**:
  - `adaptiveStream: true`, `dynacast: true`, `publishDefaults: { simulcast: true }` (Sentinel).
  - Students subscribe only to the host's tracks, the active screen share, and promoted students' tracks; no student grid.
  - The one-share-at-a-time rule is enforced server-side: when a new share starts (`track_published` webhook, source `screen_share`), the server tells the previous sharer's client (via Reverb) to stop sharing, and falls back to muting that track with `mutePublishedTrack` if the client does not respond.
  - **`autoSubscribe`**: Sentinel's rule is `false` plus explicit, reference-counted subscriptions (`track-subscriptions.ts`). Because Megaphone students publish nothing unless promoted, auto-subscribing is safe for them; keep explicit subscriptions on the host side.
  - Connection: deduplicated connect plus reconnect back-off (Sentinel `connect-room.ts`, `use-room-connection.ts`).

## 6. Infrastructure & Deployment

- **Local** (Sentinel pattern): Docker Compose. One app image runs as separate containers selected by `APP_ROLE`:
  - `web` (nginx + Octane)
  - `worker` (Horizon)
  - `reverb`
  - `scheduler`
  - Plus MySQL, Redis, LiveKit (`--dev`), Mailpit, and an edge nginx with self-signed TLS for `*.megaphone.local` that proxies Reverb (`/app`) and LiveKit (`/rtc`).
- **Production, including LiveKit (TURN/TLS, Redis, nodes)**: designed by the team separately and **not based on Sentinel's AWS setup**. **[OPEN]** Hosting, CI/CD and environments TBD.
- The app must stay infra-agnostic: all endpoints and secrets come from config/env (`LIVEKIT_URL`, `LIVEKIT_PUBLIC_URL`, keys, Reverb, Redis, DB).

## 7. Non-Functional Requirements

- Up to **500 concurrent participants per room** (few publishers, many subscribers).
- **Peak (initial target): 10 concurrent rooms**, i.e. up to ~5,000 concurrent participants in the worst case (10 × 500). This sizes LiveKit and Reverb.
- A load test (e.g. `lk load-test`) at one 500-person room and at 10 concurrent rooms is required before launch. Sentinel has no SFU load tests to borrow from.
- Join-to-video under ~3 seconds on a normal connection.
- Supported browsers: latest Chrome, Edge, Firefox, Safari (desktop + mobile).
- Room links must be unguessable; rate limiting on join/token endpoints.
- Accessibility: WCAG 2.2 AA (Sentinel).

## 8. Design

- **No Sentinel branding.** Megaphone does not use Sentinel's logo, palette or fonts; its own visual identity is TBD.
- Until then, use the starter kit's default shadcn/ui theme.
- General UI rules carried over from Sentinel because they are about quality, not brand:
  - semantic colour tokens only;
  - dark mode supported;
  - skeletons rather than spinners while data loads;
  - `tabular-nums` for numbers;
  - WCAG 2.2 AA.
- **[OPEN]** Megaphone logo, colours, typography.

## 9. Code Conventions (Sentinel `sentinel-api/CODING_STANDARDS.md`)

- **Controllers and services**:
  - Thin controllers.
  - Stateless services in `app/Services/<Domain>/` that take models as typed arguments, wrap writes in `DB::transaction`, and do not call other services.
  - Third-party integrations in `app/Libraries/<Vendor>/`.
  - No repositories.
- **Models**:
  - UUID route keys (`HasUuids`) and `SoftDeletes` on every model.
  - `#[Fillable]` / `#[Hidden]` attributes.
  - Query logic in model scopes.
  - Enum-backed status columns.
  - Auditing via `owen-it/laravel-auditing`.
- **Migrations and code style**:
  - One table per migration.
  - Docblock on every method.
  - `config()` rather than `env()` outside config files.
- **Testing and formatting**:
  - PHPUnit 12 (not Pest) with factories and `RefreshDatabase`, run against MySQL.
  - Pint (default Laravel preset) enforced by a pre-commit hook.
  - Frontend: ESLint 9 + Prettier (tailwind plugin), Vitest, Playwright for end-to-end tests.
- **Git**:
  - Git-flow: `develop` / `master`, `release/v*`.
  - No ticket numbers for now: branches are `feature/Short_Title_Words` / `bugfix/Short_Title_Words`.
  - Semver tags trigger deploys.
  - `CHANGELOG.md` in Keep a Changelog format.

## 10. Data Model (draft)

- `users`: admins (uuid, name, email, password) + spatie roles/permissions.
- `admin_invitations`: email, role, token, expires_at, accepted_at.
- `rooms`: uuid, host_id (→ users), title, description, max_participants, max_speakers, starts_at, ends_at, status, created_by, settings (json), livekit_room_name. Join slugs live on `room_links`.
- `room_admins`: room_id, user_id. Unique (room_id, user_id); cannot contain the room's host.
- `room_links`: room_id, slug (unique), label, expires_at, revoked_at, created_by.
- `guests`: uuid, name, email (unique).
- `attendances`: room_id, participant_identity, guest_id / user_id (nullable), joined_at, left_at.
- `room_events`: room_id, actor, type (`HAND.RAISED`, `HAND.LOWERED`, `SPEAKER.PROMOTED`, `SPEAKER.DEMOTED`, `SCREENSHARE.STARTED`, `SCREENSHARE.STOPPED`, …), payload, created_at.

## 11. Out of Scope (for now)

- Payments / ticketing.
- Native mobile apps.
- Breakout rooms.
- Chat, Q&A, polls, reactions, recording (post-MVP).
- i18n (English only for the MVP; Sentinel uses next-intl, which does not apply to Inertia).

## 12. Open Questions

1. Production infrastructure: hosting, LiveKit deployment, CI/CD, environments (team to design).
2. Megaphone branding: logo, colours, typography.
3. Default stage limit for promoted students (proposed: 4).
