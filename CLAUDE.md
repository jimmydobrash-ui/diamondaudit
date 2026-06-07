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
| Language | TypeScript (loose: `strict: false`, `noImplicitAny: false`) |
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
| E2E tests | Playwright (`@playwright/test` v1.57, configured; no specs written yet — see "Known gaps") |

**No SSR / no Next.js.** This is a pure SPA. The earlier `dobrash-diamond` Next.js project is a separate codebase.

---

## Deployment

- **Production**: [diamondaudit.io](https://diamondaudit.io) (root + `www`) — Cloudflare DNS pointing to Vercel.
- **Hosting**: Vercel static build from `main`. `vercel.json` rewrites all paths to `/index.html` so React Router handles deep links (password reset, future invite URLs, direct navigation). Static assets under `dist/` are served before the rewrite.
- **Supabase Auth URL config**: Site URL and additional redirect URLs are set for `https://diamondaudit.io` so password reset / signup confirmation emails point to production, not localhost.

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
├── playwright.config.ts         — vanilla @playwright/test, testDir ./tests/e2e (dir not created yet)
├── vitest.config.ts             — jsdom env, src/**/*.{test,spec}.{ts,tsx}
├── .env                         — VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (committed!)
├── public/                      — favicon.ico, placeholder.svg, robots.txt
├── supabase/
│   ├── config.toml              — project_id only
│   └── migrations/              — 5 SQL files, full schema + RLS
└── src/
    ├── main.tsx                 — React root
    ├── App.tsx                  — Routes + ProtectedRoute/AuthRoute wrappers
    ├── index.css                — Tailwind layers + design tokens (HSL vars, light + dark)
    ├── App.css                  — legacy Vite default styles (mostly unused)
    ├── pages/                   — 11 route components
    ├── components/              — feature components + ui/ (shadcn)
    ├── hooks/                   — useAuth, usePlayers, useEvaluations, etc.
    ├── integrations/supabase/
    │   ├── client.ts            — createClient with localStorage session
    │   └── types.ts             — auto-generated from DB schema
    ├── lib/
    │   ├── utils.ts             — shadcn `cn` helper
    │   └── mock-data.ts         — mostly dead; only `getAgeGroup` is still used
    └── test/                    — vitest setup + example.test.ts
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
| `*` | [`NotFound.tsx`](src/pages/NotFound.tsx) | 404 |

---

## Data model (Supabase Postgres)

All tables have RLS enabled. Org isolation is enforced through SECURITY DEFINER helpers (`has_role`, `is_org_member`, `get_user_org_id`) to avoid recursive RLS.

| Table | Purpose | Notable columns / constraints |
|---|---|---|
| `organizations` | tenant root | `name`, `slug` (unique) |
| `user_roles` | RBAC | `(user_id, organization_id, role)` unique; role enum: `admin` \| `coach` |
| `profiles` | per-user | `user_id` unique, `display_name`, `current_organization_id` |
| `players` | roster | `first_name`, `last_name`, `date_of_birth`, `positions[]`, `bats` (L/R/S), `throws` (L/R), `height`, `weight`, `jersey_number`, `tags[]` |
| `tryout_events` | (defined, not actively used yet) | `event_date`, `age_groups[]`, `status` |
| `evaluation_templates` | per-org skill template | `categories` JSONB; one `is_default = true` per org |
| `evaluations` | per-coach scores | `(player_id, coach_id, event_id)` unique; `scores` JSONB; `notes` |
| `player_grades` | per-coach Offer/Bubble/Pass | `(player_id, coach_id)` unique; grade enum: `offer` \| `bubble` \| `pass` |
| `organization_invites` | coach invite system (in-app only — see below) | `email`, `role`, `status`, `expires_at` (default 7d) |

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
7. `20260522000000_lock_down_role_invite_eval` — locks down role/invite/evaluation policies. **Applied to the live prod DB via the Supabase MCP on 2026-06-06** (not in `supabase/migrations/` as a local file).

---

## Auth flow

[`useAuth`](src/hooks/useAuth.tsx) is the single source of truth for `session`, `user`, `profile`, `organizationId`, and `role`. On auth state change it:
1. Loads the user's profile.
2. If no `current_organization_id`, delegates to [`bootstrapOrganization`](src/lib/orgBootstrap.ts) which creates the `organizations` + `user_roles` (admin) + seeds the default `evaluation_templates` row.
3. Persists the chosen org back to `profiles`.

[`Auth.tsx`](src/pages/Auth.tsx) handles signin/signup/forgot. On signup it stashes the user-chosen org name in `user_metadata.pending_org_name`; `bootstrapOrganization` reads it back when creating the org. On password reset, the user is redirected to `/auth/recover` which calls `supabase.auth.updateUser({ password })`.

`bootstrapOrganization` generates the org UUID client-side so the insert doesn't need a `.select()` (which would fail RLS — at the moment of insert, the user isn't yet a member of the org they just created). This is the correct pattern; don't revert to `.insert(...).select()`.

---

## Invites (no email yet)

The coach invite system is **in-app only**. `InviteCoachDialog` inserts a row into `organization_invites`; nothing is emailed. No Resend integration, no Supabase Edge Functions (`supabase/functions/` doesn't exist), no email-related env vars. The "Invite sent to {email}" toast is misleading.

A recipient only learns about an invite if they happen to sign up or log in with the invited email — at which point [`PendingInviteBanner`](src/components/PendingInviteBanner.tsx) polls the table (email match, case-insensitive) and lets them accept. New signups always create a fresh org via `bootstrapOrganization`, so an invited-but-not-yet-registered user ends up in *their own* org and would have to accept the banner to join the inviter's org (ending up in both).

Planned fix: shareable copy-link UX from the dialog + Auth-page handling for `?invite=1&email=...`. Not implemented yet.

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

---

## Evaluations: catcher rule

[`EvaluatePlayer.tsx`](src/pages/EvaluatePlayer.tsx) hides the `id === "catching"` template category when the player's `positions[]` is set and does *not* include `"C"`. Empty/null `positions[]` shows all categories.

- The hide is **UI-only**. The init effect still walks the full template, so any existing catcher scores survive the `upsert_evaluation` RPC (which does a full `scores = EXCLUDED.scores` replace, not a JSONB merge).
- Side effect: non-catchers no longer save phantom default-`5` catcher slider values, so their leaderboard overalls reflect only categories they were actually evaluated on.
- Hardcoded to the seeded `"catching"` id. If an org deletes/recreates the catcher category with a different id, the rule won't apply.

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

The repo includes both `package-lock.json` and `bun.lock` / `bun.lockb`. **Pick one** — if sticking with npm, delete the bun lockfiles. Lovable used Bun by default.

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
npm run lint     # ESLint
npm run test     # Vitest (one-shot)
npm run test:watch
```

Playwright is configured and runnable (`npx playwright test`), but no e2e specs exist yet — see "Known gaps".

---

## Lovable cleanup status

All removed: `lovable-tagger` (config + dependency), broken Playwright config (replaced with vanilla `@playwright/test`), Lovable meta tags in `index.html`, OG image pointing to Lovable's CDN, generic `vite_react_shadcn_ts` package name, `bun.lock`/`bun.lockb`, "Welcome to your Lovable project" README. The `.env` file has been renamed to `.env.local` (gitignored) with a checked-in `.env.example`. The favicon is still a generic placeholder — replace when ready.

---

## Conventions

- **Aliases:** `@/*` → `src/*` (configured in `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`).
- **Styling:** Tailwind utilities + shadcn HSL CSS variables in [`src/index.css`](src/index.css). Use semantic tokens (`bg-primary`, `text-foreground`, `bg-card`, etc.) — avoid hardcoded colors.
- **Border radius:** `var(--radius)` = `0.75rem`. Cards and buttons are intentionally rounded (this differs from the sibling `dobrash-diamond` Next.js project, which uses sharp edges).
- **Page structure:** every protected page renders `<AppLayout>{...}</AppLayout>`. AppLayout owns the sticky header (org switcher + user pill + sign-out) and the bottom nav.
- **Mutations:** use React Query `useMutation`; on success, `qc.invalidateQueries({ queryKey: [...] })`.
- **Toasts:** `import { toast } from "sonner"`.
- **TypeScript:** loose mode (`strict: false`, `strictNullChecks: false`). When tightening this, expect a long list of fixes — do it incrementally per directory.

---

## Verified working on production

- Custom domain `diamondaudit.io` (root + `www`) resolves to the Vercel deployment.
- Deep links (e.g. `/players`, `/auth/recover`) load via the SPA rewrite — no Vercel 404.
- Password reset flow: request from `/auth` → email arrives → link lands on `/auth/recover` → password update succeeds → sign-in works.
- Catcher-category hide rule live in `EvaluatePlayer`.

## Known gaps

- Invite emails are not implemented (see "Invites" section above).
- Playwright is wired up (`@playwright/test` v1.57, vanilla config pointing at `./tests/e2e`) but no e2e specs are written yet — the `tests/e2e/` directory doesn't exist.
- Generic placeholder favicon.
