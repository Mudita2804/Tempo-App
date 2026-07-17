# Tempo — Vision & In-Flight Discussions

Working document for everything discussed but **not yet shipped**. COACH.md records what's committed and in production; this file records planning, challenges, decisions, and pending work in between.

**Maintenance rule:** When an item ships to production (committed + deployed), remove it from here and record it in COACH.md's changelog. Claude keeps this file updated during every session.

---

## In flight (started, not finished)

### `created_at` timestamps on entries + messages (2026-07-10)
**Status:** SQL run in production Supabase — columns exist. Pending: end-to-end verification (log something, confirm fresh timestamp), then update COACH.md schema section.
**What:** `alter table entries/messages add column created_at timestamptz not null default now();`
**Why:** "Last sign-in" was misleading for tracking user activity — Supabase JWT refresh keeps sessions alive for days, so users never re-"sign in." Activity-based tracking (max `created_at` per user) shows real engagement.
**Gotchas discovered:**
- All pre-existing rows were backfilled with the ALTER's execution time (2026-07-10 ~11:37 UTC / 5:07 PM IST) — historical "last active" only accrues from now on.
- Dashboard shows timestamps in UTC; use `at time zone 'Asia/Kolkata'` when eyeballing.
- `dbReplaceEntries` is delete-then-insert of all of today's rows, so `entries.created_at` means "last sync time," not "when logged." Correct for last-active analytics; do not use as per-entry log time. `messages` is append-only, so those timestamps are true.

---

## Decisions made (conventions, no code needed)

### Deploy workflow — real users are live (2026-07-10)
5 users active; no more direct pushes to `main`.
1. Branch → Vercel preview deployment → test on preview URL → merge to `main`.
2. Pre-commit: `tsc` + curl test of `/api/coach` (existing convention).
3. Schema changes **additive only** — add columns/tables with defaults, never drop/rename what prod code reads. Vercel Instant Rollback does not roll back the DB.
4. After each prod deploy, 4-step smoke test: log a food → answer a clarifying question → correct an entry → delete an entry (covers RULES 1–5 contract).
5. Previews share the prod Supabase DB — test with Mudita's own account only.
5c. Supabase OAuth redirect allow-list now includes `https://*-muditaj28-2492s-projects.vercel.app/**` (added 2026-07-14). Without it, logging in on any preview silently redirected to production (Supabase falls back to the Site URL for non-allow-listed redirects) — made preview testing of logged-in flows impossible and produced a false "fix doesn't work" test result.
5b. Vercel env vars are scoped per environment — all vars now enabled for Preview as well as Production (fixed 2026-07-14 after first-ever preview build 500'd with MIDDLEWARE_INVOCATION_FAILED; `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` were Production-only). Any *new* env var must be added with both Production and Preview checked.
6. Deliberately skipped at this scale: staging DB, feature flags, canary.

### User activity metrics — which signal means what (2026-07-10)
- **Last coach interaction** (`messages`) = last API call / app usage. Primary retention signal.
- **Last entry logged** (`entries`) = last actual tracking. Secondary signal — a user who chats but stops logging is a different failure mode than one who disappears.
- Snapshot 2026-07-10: 5 signups, 5 onboarded, 122 entries, 4 of 5 users active today. Churn risk: singh.gargi62 (1 entry on signup day, silent since).
- Snapshot 2026-07-14: 7 signups, 161 entries. Retention cooled — only Mudita active since Jul 10 (last: Jul 13 9:47 PM IST); pooja/ruchi/gargi silent since the Jul 10 backfill, grvjn last active Jul 10 7:28 PM. **New funnel leak:** 2 newest signups (mansij.nitb Jul 10, karwa.ankit32 Jul 13) have zero entries and zero coach messages — never reached first interaction.
- Investigated 2026-07-14 — two *different* drop points:
  - **mansij.nitb (Mansi Jain):** completed full onboarding in ~2 min (profile + 3 goals exist), then bounced at the Today screen without one coach interaction. Empty-state → coach handoff failed despite the 2026-07e empty-state card/chips.
  - **karwa.ankit32:** OAuth succeeded, quit mid-onboarding (no profile row, no goals). Which step unknown — no instrumentation.

- Snapshot 2026-07-17: 8 signups (7 real — mudita2896@gmail.com confirmed as Mudita's test account, exclude from funnel stats), 161 entries — **zero new entries since Jul 13** (4-day full dormancy, founder included). Real zero-first-log group: 2 of 7 (mansij, karwa). Jul 8–10 cohort stopped cold after 1–3 days. Mudita's own diagnosis: "laziness, no push from TEMPO" — nothing drives day-2 return.

### Planned: daily log-reminder notifications (retention, agreed 2026-07-17)
Sequence agreed with Mudita:
1. **v1 — daily email reminder.** Vercel cron → API route → query users with no entry today (`created_at`) → send via Resend (free tier, ~250/month needed) at ~8:30 PM IST with deep link into the coach. Emails already on file from Google OAuth. Skip-if-logged. ~1 session of work.
2. **Measure ~2 weeks:** emailed → logged-within-2h conversion, using existing created_at analytics.
3. **v2 — WhatsApp** (Meta Cloud API) only if email shows the nudge works but channel is weak. All users are India-based; WhatsApp is the high-open-rate channel but needs business verification + message templates.
- Rejected: SMS (per-message cost, no phone numbers collected, low signal in India).
- Companion: add-to-home-screen / PWA installability — **built 2026-07-17** on branch `feat/pwa-install` (manifest + icons + install prompt; see COACH.md session 2026-07i). Pending preview verification → merge.
- Note: notifications amplify a habit loop, they don't create one — if email conversion is near zero, the problem is product value on day 2, not channel.

### Idea: first-log activation flow (from Mansi's drop)
After onboarding completes, don't land on an empty Today screen — open the coach directly with a personalized first message ("You're set up, Mansi. What did you eat today?"). Converts setup momentum into the first log. Priority: high (user who invested full setup was lost at the value-delivery moment).

### Idea: onboarding step instrumentation (from Ankit's drop)
No visibility into where mid-onboarding drops happen. Option: persist a lightweight `onboarding_step` on the profile (or a tiny events table) so drop-off step is queryable. Priority: low at n=1, revisit if pattern repeats.

---

## Planned / discussed, not started

### Edit logs from previous days
**Verdict:** Buildable, but it's a data-layer feature wearing a UI costume. Sequencing agreed:
1. Per-date sync function — `dbReplaceEntries` currently deletes/re-inserts `where entry_date = today` and stamps everything with today's date; naively reusing it for a past day **corrupts data** (yesterday's entries rewritten as today's). Needs `dbReplaceEntriesForDate(date, entries)`.
2. Date picker + read-only view of past days.
3. UI editing (SlideOver + trash already exist, need date scoping).
4. Coach-driven editing of past days — **deferred until users ask.** Highest risk: `logSummary`, `correctionTargets`, RULE 5 matching are all today-scoped; multi-day LLM context risks regressing the hardened correction behavior.

**Other challenges noted:** Zustand store has no date dimension (keep store today-only, build a self-contained past-day edit flow instead of restructuring); `local_id` uniqueness is per-day; `todayStr()` is client-timezone; editing history rewrites `created_at` (becomes "last touched"); Trends recomputes correctly from raw entries but judges past days against the *current* goal target.

### Scale readiness — path to 100 users
- **Supabase free tier: fine.** ~180 MB/year of entries at 100 active users vs 500 MB limit; auth/egress/compute are non-issues. Don't revisit until ~50 active users.
- **Risk 1 — no backups on free tier.** Before inviting 100 users: upgrade to Pro (daily backups) or script a weekly `pg_dump`.
- **Risk 2 — Gemini free tier is the real bottleneck.** Hard RPM/day caps → 429s at dinnertime peak long before Supabase feels load; `localFallback` degrades poorly and the coach is the product. Budget a paid Gemini key as the first real infra cost.
