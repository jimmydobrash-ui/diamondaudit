---
title: DiamondAudit — CLAUDE.md
project: DiamondAudit
app_url: https://app.diamondaudit.io
marketing_url: https://diamondaudit.io
repo: https://github.com/jimmydobrash-ui/diamondaudit
updated: 2026-06-23
---

# DiamondAudit — CLAUDE.md

> Originally generated in [Lovable](https://lovable.dev) and pushed to GitHub. Now being developed locally with Claude Code. Self-hosted Supabase project (no longer using Lovable's provisioned backend).

---

## What this app does

**DiamondAudit** is a multi-tenant web app for running baseball tryouts. Coaches sign up, get their own organization, add a roster (manually or via CSV import), evaluate players against a customizable skill template, grade them as **Offer / Bubble / Pass**, and review a leaderboard for team-building decisions. Multiple coaches per org can invite each other and evaluate the same players independently — each coach's evaluations and grades are stored separately and rolled up.

**Tagline (from `index.html`):** *"Run faster tryouts. Evaluate players with real data. Make confident team decisions with DiamondAudit."*

**Branding** is now consistent throughout — `DA` logo bubble, `DiamondAudit` heading. The "Tryout Eval" leftovers are gone.

---

## Tech stack

| Layer | Tool |
|---|---|
| Build | Vite 5 + `@vitejs/plugin-react-swc` |
| Language | TypeScript (**strict mode**) — `npm run typecheck`; the Vite/SWC build does **not** type-check |
| UI framework | React 18 + react-router-dom v6 |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives, ~49 components in [`src/components/ui/`](src/components/ui/)) |
| Animation | framer-motion 11 |
| Forms | react-hook-form + zod + `@hookform/resolvers` |
| Data fetching | `@tanstack/react-query` v5 |
| Backend / DB / Auth | Supabase (`@supabase/supabase-js` v2) — Postgres + Auth + RLS |
| Toasts | `sonner` (primary) and shadcn `toaster` (mounted but unused secondary) |
| Icons | lucide-react |
| Charts | recharts |
| Unit tests | Vitest + Testing Library + jsdom |
| E2E tests | Playwright (`@playwright/test` v1.57; smoke specs in `tests/e2e/`, run via `npm run test:e2e`) |

**No SSR / no Next.js.** This is a pure SPA. The earlier `dobrash-diamond` Next.js project is a separate codebase.

---

## Deployment

**Two sites, both built from this one repo** (split done 2026-06-23, mirroring DiamondReps):

- **Marketing landing** — `diamondaudit.io` (root + `www`). A static page in [`landing/`](landing/) (no build step), its own Vercel project. [`landing/vercel.json`](landing/vercel.json) redirects old app paths (`/auth`, `/players`, `/evaluate`, `/team-builder`, `/leaderboard`, `/settings`, `/scoring-guide`) to the app subdomain so pre-cutover links and already-sent reset emails don't 404.
- **App** — `app.diamondaudit.io`. The Vite SPA (`src/`), its own Vercel project, auto-deploys from `main`. Root [`vercel.json`](vercel.json) rewrites all paths to `/index.html` for React Router deep links.
- Both Vercel projects watch `main`: the app project builds `src/` (ignores `landing/`); the marketing project serves `landing/` (ignores `src/`). Every push deploys both.
- **DNS**: Cloudflare → Vercel.
- **Supabase Auth URL config**: Site URL = `https://app.diamondaudit.io` (+ matching redirect URLs) so password-reset / confirmation / invite emails point to the app host. When `send-invite` is deployed, set its `SITE_URL` secret to `https://app.diamondaudit.io`.

---

## Repo layout

```
diamondaudit/
├── index.html                   — single-page entry
├── vercel.json                  — SPA rewrite: all paths → /index.html
├── vite.config.ts               — port 8080, @ alias to ./src
├── tailwind.config.ts           — shadcn HSL CSS vars + custom success/warning/info
├── components.json              — shadcn config (slate base, css vars, @/components alias)
├── eslint.config.js             — flat config, react-hooks + react-refresh
├── playwright.config.ts         — vanilla @playwright/test, testDir ./tests/e2e
├── vitest.config.ts             — jsdom env, src/**/*.{test,spec}.{ts,tsx}
├── .env.local                   — gitignored; .env.example documents the keys
├── public/                      — favicon-32/192.png, apple-touch-icon.png, logo.png/logo-256.png, robots.txt
├── supabase/
│   ├── config.toml              — project_id only
│   ├── functions/send-invite/   — Resend invite-email Edge Function (+ README)
│   └── migrations/              — full schema + RLS (see Migrations list)
└── src/
    ├── main.tsx                 — React root
    ├── App.tsx                  — lazy-loaded routes + ProtectedRoute/AuthRoute; global query-error toasts
    ├── index.css                — Tailwind layers + design tokens (HSL vars, light + dark)
    ├── App.css                  — legacy Vite default styles (mostly unused)
    ├── pages/                   — 12 route components
    ├── components/              — feature components (OverallScore, ScoringRuler, …) + ui/ (shadcn)
    ├── hooks/                   — useAuth, usePlayers, useEvaluations, etc.
    ├── integrations/supabase/
    │   ├── client.ts            — createClient with localStorage session
    │   └── types.ts             — generated from DB schema (regen via Supabase MCP/CLI)
    ├── lib/
    │   ├── utils.ts             — shadcn `cn` helper
    │   ├── scoring.ts           — scoring source of truth (see Scoring)
    │   ├── orgBootstrap.ts      — org creation + invite auto-join at signup
    │   └── mock-data.ts         — mostly dead; only `getAgeGroup` is still used
    └── test/                    — vitest setup + lib/component tests
```

---

## Routing

All routes are wrapped in `ProtectedRoute` (redirects to `/auth` if no session). `/auth` itself is wrapped in `AuthRoute` (redirects home if already signed in).

| Path | Page | Purpose |
|---|---|---|
| `/auth` | [`Auth.tsx`](src/pages/Auth.tsx) | sign in / sign up / forgot password / "check your email" |
| `/auth/recover` | [`AuthRecover.tsx`](src/pages/AuthRecover.tsx) | landing page from password reset email link |
| `/` | [`Index.tsx`](src/pages/Index.tsx) | dashboard: stats grid, top 5 players |
| `/players` | [`Players.tsx`](src/pages/Players.tsx) | roster list |
| `/players/add` | [`AddPlayer.tsx`](src/pages/AddPlayer.tsx) | manual add form |
| `/players/import` | [`ImportPlayers.tsx`](src/pages/ImportPlayers.tsx) | CSV import |
| `/evaluate` | [`EvaluateList.tsx`](src/pages/EvaluateList.tsx) | players awaiting evaluation |
| `/evaluate/:playerId` | [`EvaluatePlayer.tsx`](src/pages/EvaluatePlayer.tsx) | per-player evaluation form |
| `/team-builder` | [`TeamBuilder.tsx`](src/pages/TeamBuilder.tsx) | grade as Offer/Bubble/Pass |
| `/leaderboard` | [`Leaderboard.tsx`](src/pages/Leaderboard.tsx) | ranked results |
| `/settings/template` | [`ManageTemplate.tsx`](src/pages/ManageTemplate.tsx) | customize evaluation template |
| `/scoring-guide` | [`ScoringGuide.tsx`](src/pages/ScoringGuide.tsx) | rubric reference (score → tier → meaning); reached via the header help icon |
| `*` | [`NotFound.tsx`](src/pages/NotFound.tsx) | 404 |

All route pages are lazy-loaded (`React.lazy`) so each is its own chunk; the auth wrappers stay eager.

---

## Data model (Supabase Postgres)

All tables have RLS enabled. Org isolation is enforced through SECURITY DEFINER helpers (`has_role`, `is_org_member`, `get_user_org_id`) to avoid recursive RLS. These helpers keep `EXECUTE` for `authenticated` (RLS policies call them) but **not** `anon`/PUBLIC (see migration 8); don't re-grant them broadly.

| Table | Purpose | Notable columns / constraints |
|---|---|---|
| `organizations` | tenant root | `name`, `slug` (unique) |
| `user_roles` | RBAC | `(user_id, organization_id, role)` unique; role enum: `admin` \| `coach` |
| `profiles` | per-user | `user_id` unique, `display_name`, `current_organization_id` |
| `players` | roster | `first_name`, `last_name`, `date_of_birth`, `positions[]`, `bats` (L/R/S), `throws` (L/R), `height`, `weight`, `jersey_number`, `tags[]` |
| `tryout_events` | (defined; intentionally retained for a planned scheduling feature, not used by the app yet) | `event_date`, `age_groups[]`, `status` |
| `evaluation_templates` | per-org skill template | `categories` JSONB; one `is_default = true` per org |
| `evaluations` | per-coach scores | `(player_id, coach_id, event_id)` unique; `scores` JSONB; `notes` |
| `player_grades` | per-coach Offer/Bubble/Pass | `(player_id, coach_id)` unique; grade enum: `offer` \| `bubble` \| `pass` |
| `organization_invites` | coach invite system (in-app only — see below) | `email`, `role`, `status`, `expires_at` (default 14d via migration 9 — **prod still 7d until applied**) |

**RLS rules of thumb:**
- Members can `SELECT` anything in their org.
- Admins can manage players, events, templates, and invites.
- Coaches can `INSERT`/`UPDATE` their **own** evaluations and grades.
- A trigger on `auth.users` (`handle_new_user`) auto-creates a profile row on signup.

**Migrations** (under `supabase/migrations/`):
1. `20260324222307` — initial schema, all RLS, helper functions, triggers
2. `20260324222741` — allows authenticated users to bootstrap their own org + role at signup
3. `20260326200055` — adds `player_grades` table
4. `20260409001448` — adds `organization_invites` table
5. `20260409001659` — admin-can-delete policies for grades and invites
6. `20260507000000` — tightens profile RLS (org-scoped reads), fixes `evaluations` uniqueness with partial indexes, adds `upsert_evaluation` RPC
7. `20260522000000_lock_down_role_invite_eval` — locks down `user_roles` INSERT (bootstrap-or-matching-invite only), an `organization_invites` immutability trigger, and player/event ownership checks in `upsert_evaluation`. **Applied to prod.**
8. `20260608000000_lock_down_fn_grants_and_org_insert` — revokes anon/PUBLIC `EXECUTE` on the SECURITY DEFINER helpers (keeps `authenticated` for the RLS helpers + `upsert_evaluation`; internal trigger fns owner-only), and replaces the `organizations` INSERT `WITH CHECK (true)` with a first-org bootstrap check. **Applied to prod + verified (RLS intact).**
9. `20260624000000_bump_invite_expiry_14d` — bumps the `organization_invites.expires_at` column default from 7d to 14d (new invites only). **NOT yet applied to prod** — run the `ALTER` in the SQL editor to sync.

> **Note:** migrations are applied manually (via the Supabase MCP/SQL editor), not by a CI pipeline — the `supabase_migrations` tracking table is empty. Keep the `.sql` files and prod in sync by hand.

---

## Auth flow

[`useAuth`](src/hooks/useAuth.tsx) is the single source of truth for `session`, `user`, `profile`, `organizationId`, and `role`. On auth state change it:
1. Loads the user's profile.
2. If no `current_organization_id`, delegates to [`bootstrapOrganization`](src/lib/orgBootstrap.ts) which creates the `organizations` + `user_roles` (admin) + seeds the default `evaluation_templates` row.
3. Persists the chosen org back to `profiles`.

[`Auth.tsx`](src/pages/Auth.tsx) handles signin/signup/forgot. On signup it stashes the user-chosen org name in `user_metadata.pending_org_name`; `bootstrapOrganization` reads it back when creating the org. On password reset, the user is redirected to `/auth/recover` which calls `supabase.auth.updateUser({ password })`.

`bootstrapOrganization` generates the org UUID client-side so the insert doesn't need a `.select()` (which would fail RLS — at the moment of insert, the user isn't yet a member of the org they just created). This is the correct pattern; don't revert to `.insert(...).select()`.

**Invite auto-join:** before creating a new org, `bootstrapOrganization` checks for a pending `organization_invites` row matching the new user's email. If found, it joins that org instead (inserts the `user_roles` row, marks the invite `accepted`, sets it current) — so an invited user lands in the inviter's org rather than getting their own *and* the invited one.

---

## Invites

An admin invites a coach via [`InviteCoachDialog`](src/components/InviteCoachDialog.tsx), which inserts a row into `organization_invites`. Three ways the recipient ends up in the org:

1. **Email** — the dialog calls the [`send-invite`](supabase/functions/send-invite/) Edge Function (Resend) with the invite id; the function verifies the caller is an org admin (service role) and emails the link `…/auth?invite=1&email=…`. **Inert until deployed + secrets set** (see its README); the dialog **falls back to the copy-link UX** if the call fails, so invites always work.
2. **Auto-join at signup** — if the recipient signs up with the invited email, `bootstrapOrganization` auto-joins them to the inviter's org (see Auth flow).
3. **Pending-invite banner** — an already-registered user with a matching pending invite sees [`PendingInviteBanner`](src/components/PendingInviteBanner.tsx) and can accept (this is the path for adding an *existing* user to an *additional* org).

`Auth.tsx` reads `?invite=1&email=…` to prefill the email and skip the org-name field (so signup doesn't stash a `pending_org_name`).

---

## Scoring rubric

All slider scores reflect skill level relative to organized baseball competition.

| Score | Tier | Meaning |
|---|---|---|
| 10 | Unicorn | Will excel at Major league level |
| 9 | Elite | Will compete at Major league level |
| 7-8 | Above Average | Will excel at AAA level; potential to play Major |
| 5-6 | Average | Will compete at AAA level |
| 3-4 | Below Average | Will compete at AA competition level |
| 1-2 | Needs significant work | Not yet at AA/AAA competition level |

**Notes for coaches:**

- Sliders start at zero. Only score what you actually observed. Skipping is better than guessing.
- Player position and age display at the top of each eval. Calibrate against age and league expectations.
- If two coaches score the same player very differently, that's useful information — discuss before final team decisions.

**Slider behavior:**

- 1-8: 0.5 increments allowed
- 9-10: whole numbers only

### How scoring is computed & shown

[`src/lib/scoring.ts`](src/lib/scoring.ts) is the single source of truth:

- **`calcSliderOverall(scores, categories)`** — a player's overall is the average of **slider-type skills only**, on a **0–10** scale. Number-type skills (velocities in mph, times in sec) are **excluded** so they don't distort the scale. (A prior bug used a flat average of *all* fields, producing nonsense like "11.1"; that's gone.)
- **`aggregateScoresByPlayer(evaluations)`** — the canonical cross-coach roll-up: average each skill across the coaches who scored it (rounded to 1 dp), *then* compute the overall. **Every screen** (Players, dashboard, EvaluateList, TeamBuilder, Leaderboard) runs through this, so a player shows the **same number everywhere** regardless of coach count.
- **`SCORE_TIERS` + `scoreTier(value)`** — maps an overall to its rubric tier; drives both the [`ScoringGuide`](src/pages/ScoringGuide.tsx) page and the inline tier tag.
- **`<OverallScore value showTier />`** ([component](src/components/OverallScore.tsx)) — always renders the scale (`X.X / 10`) and, with `showTier`, the tier badge (e.g. `Average (AAA)`).
- **`<ScoringRuler />`** ([component](src/components/ScoringRuler.tsx)) — the calibration strip above the evaluate sliders; tier zones laid out proportionally across the 1–10 domain so each sits above where that score lands.

---

## Evaluations: catcher rule

[`EvaluatePlayer.tsx`](src/pages/EvaluatePlayer.tsx) hides the `id === "catching"` template category when the player's `positions[]` is set and does *not* include `"C"`. Empty/null `positions[]` shows all categories.

- The category **hide is UI-only** — the init effect still walks the full template and defaults *every* slider (incl. hidden catching) to `5` in form state. What keeps phantom catching out of the DB is the **save filter**: `handleSave` persists only the skills in `visibleEvalCategories(...)` via [`scoresForVisiblePlayer`](src/lib/scoring.ts). Without that filter, non-catchers wrote `catching = 5` and it dragged their overall toward 5 (found in the June 24 prod audit — overalls off by up to 0.8, enough to reorder players).
- Because the save is a full `scores = EXCLUDED.scores` replace (not a JSONB merge), re-saving a non-catcher also **cleans up** any pre-existing phantom catching scores. A real catcher (or a player with empty `positions`, which shows all categories) still saves catching normally.
- Hardcoded to the seeded `"catching"` id. If an org deletes/recreates the catcher category with a different id, the rule won't apply.

**Loading saved scores:** `EvaluatePlayer` populates the form only once the saved-evaluation query *resolves* (tracked per-player via a ref), and `EvaluationSlider`/`EvaluationNumberInput` sync to value-prop changes. Don't reintroduce gating on a one-shot "initialized" flag set before the query resolves — that caused saved sliders to reset to the default 5 on reopen.

---

## Hooks layer (data access)

All read/write to Supabase goes through React Query hooks under `src/hooks/`:

| Hook | What it does |
|---|---|
| [`useAuth`](src/hooks/useAuth.tsx) | session/user/org/role context |
| [`usePlayers`](src/hooks/usePlayers.ts) | list / add / batch add / delete players |
| [`useEvaluations`](src/hooks/useEvaluations.ts) | org evaluations + per-player upsert |
| [`useEvaluationTemplate`](src/hooks/useEvaluationTemplate.ts) | load + save the default template |
| [`usePlayerGrades`](src/hooks/usePlayerGrades.ts) | all org grades, my grades, set/clear my grade |
| `use-toast` / `use-mobile` | shadcn helpers |

**Convention:** every query is keyed on `organizationId` and gated by `enabled: !!organizationId` so we don't hit the DB before the org is resolved.

---

## Local development

### 1. Install deps

```bash
cd diamondaudit
npm install
```

Uses npm (`package-lock.json`); the Lovable-era bun lockfiles have been removed.

### 2. Env vars

Local secrets live in `.env.local` (gitignored); a checked-in `.env.example` documents the keys. The live DiamondAudit project (Supabase project `tusmfktpooodjcsztefo`, region us-east-2, created 2026-05-07) is referenced by these three:

```
VITE_SUPABASE_PROJECT_ID="tusmfktpooodjcsztefo"
VITE_SUPABASE_URL="https://tusmfktpooodjcsztefo.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<the supabase publishable key>"
```

The `PUBLISHABLE_KEY` is the Supabase **publishable key** (`sb_publishable_...`), which is safe to ship to the browser by design.

### 3. Run

```bash
npm run dev      # http://localhost:8080 (per vite.config.ts)
npm run build    # production build to ./dist
npm run preview  # serve the build locally
npm run lint       # ESLint (0 warnings expected)
npm run typecheck  # tsc --noEmit (strict) — the build does NOT type-check
npm run test       # Vitest (one-shot)
npm run test:watch
npm run test:e2e   # Playwright (starts dev server, runs tests/e2e/)
```

Playwright smoke specs live in `tests/e2e/` — run `npm run test:e2e` (or `npx playwright test`). Authenticated flows still need a seeded test account.

---

## Lovable cleanup status

All removed: `lovable-tagger` (config + dependency), broken Playwright config (replaced with vanilla `@playwright/test`), Lovable meta tags in `index.html`, OG image pointing to Lovable's CDN, generic `vite_react_shadcn_ts` package name, `bun.lock`/`bun.lockb`, "Welcome to your Lovable project" README, dead `placeholder.svg`. The `.env` file has been renamed to `.env.local` (gitignored) with a checked-in `.env.example`. Favicons are now properly sized (`favicon-32/192.png`, `apple-touch-icon.png`); the legacy `favicon.ico` remains as a fallback. The DA logo is the brand mark.

---

## Conventions

- **Aliases:** `@/*` → `src/*` (configured in `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`).
- **Styling:** Tailwind utilities + shadcn HSL CSS variables in [`src/index.css`](src/index.css). Use semantic tokens (`bg-primary`, `text-foreground`, `bg-card`, etc.) — avoid hardcoded colors.
- **Border radius:** `var(--radius)` = `0.75rem`. Cards and buttons are intentionally rounded (this differs from the sibling `dobrash-diamond` Next.js project, which uses sharp edges).
- **Page structure:** every protected page renders `<AppLayout>{...}</AppLayout>`. AppLayout owns the sticky header (org switcher + user pill + sign-out) and the bottom nav.
- **Mutations:** use React Query `useMutation`; on success, `qc.invalidateQueries({ queryKey: [...] })`.
- **Toasts:** `import { toast } from "sonner"`.
- **TypeScript:** **strict mode** is on. Run `npm run typecheck` before committing — the Vite/SWC build skips type-checking, so type errors won't fail the build.
- **Images:** use sized assets (`logo-256.png`, the favicons), not the 1 MB `logo.png`, in UI — that's reserved for `og:image`/`twitter:image`.
- **Query errors** surface automatically via a global toast (QueryClient `queryCache.onError` in `App.tsx`); no need to handle per-query unless you want custom UX.

---

## Verified working on production

- `diamondaudit.io` (root + `www`) serves the marketing landing; `app.diamondaudit.io` serves the app — both verified live, with old-app-path redirects working.
- Deep links (e.g. `/players`, `/auth/recover`) load via the SPA rewrite — no Vercel 404.
- Password reset flow: request from `/auth` → email arrives → link lands on `/auth/recover` → password update succeeds → sign-in works.
- Catcher-category hide rule live in `EvaluatePlayer`.
- Scoring: consistent `X.X / 10` + tier labels across all screens; Scoring Guide page; calibration ruler on the evaluate page; evaluate save→reopen keeps saved scores (the reset bug is fixed).
- Security migrations 7 & 8 applied to prod and verified (authenticated RLS intact; anon can no longer call the SECURITY DEFINER helpers).
- Lighthouse on the deployed site: Accessibility/Best-Practices/SEO = 100, Performance ~80.

## Known gaps

- **Invite emails**: implemented via the `supabase/functions/send-invite` Edge Function (Resend), with copy-link fallback. **Not live until** its secrets are set and it's deployed — see [`supabase/functions/send-invite/README.md`](supabase/functions/send-invite/README.md) (`RESEND_API_KEY`, `INVITE_FROM_EMAIL`, `SITE_URL`, verify a sending domain, `supabase functions deploy send-invite`).
- **`tryout_events` table**: intentionally retained for a planned event/session-scheduling feature; no UI uses it yet. Keep until that feature is built (or drop the table + its generated types if shelved).
- **Auth: leaked-password protection** is disabled. Enable it in Supabase → Authentication → Policies (HaveIBeenPwned check). Dashboard-only toggle; not in code. *(Only open security-advisor item; the remaining "authenticated can execute SECURITY DEFINER" advisor warnings are inherent to the RLS-helper pattern and can't be removed without breaking RLS.)*
- **Performance headroom**: deployed Lighthouse is ~80 (a11y/best-practices/SEO all 100). LCP is down to ~4 s after the logo fix; further gains need render-blocking-CSS/font tuning and finer code-splitting — diminishing returns.
- **No seeded test account** for authenticated E2E — Playwright covers only the public/auth surface so far.

## Testing

- Unit/component tests: `npm test` (Vitest + Testing Library). Covers `lib/scoring` and the evaluation inputs/score display.
- E2E: `npm run test:e2e` (Playwright, specs in `tests/e2e/`). Public smoke specs (auth redirect, sign-in render) always run. Authenticated specs (`authenticated.spec.ts` — login + navigate the signed-in shell) **skip unless** `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` are set: `TEST_USER_EMAIL=… TEST_USER_PASSWORD=… npm run test:e2e`. A data-mutating flow (add player → evaluate → save → reopen) is intentionally not automated against prod — it needs a dedicated test org/DB; the save/reopen regression is covered at unit level by the evaluation-input component tests.
- Types: `npm run typecheck` (strict; the Vite/SWC build does **not** type-check).
