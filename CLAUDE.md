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
| E2E tests | Playwright (currently broken — see "Lovable cleanup" below) |

**No SSR / no Next.js.** This is a pure SPA. The earlier `dobrash-diamond` Next.js project is a separate codebase.

---

## Repo layout

```
diamondaudit/
├── index.html                   — single-page entry, has Lovable meta tags
├── vite.config.ts               — port 8080, @ alias to ./src, includes lovable-tagger
├── tailwind.config.ts           — shadcn HSL CSS vars + custom success/warning/info
├── components.json              — shadcn config (slate base, css vars, @/components alias)
├── eslint.config.js             — flat config, react-hooks + react-refresh
├── playwright.config.ts         — uses lovable-agent-playwright-config (BROKEN, package not installed)
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
| `organization_invites` | coach invite system | `email`, `role`, `status`, `expires_at` (default 7d) |

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

---

## Auth flow

[`useAuth`](src/hooks/useAuth.tsx) is the single source of truth for `session`, `user`, `profile`, `organizationId`, and `role`. On auth state change it:
1. Loads the user's profile.
2. If no `current_organization_id`, delegates to [`bootstrapOrganization`](src/lib/orgBootstrap.ts) which creates the `organizations` + `user_roles` (admin) + seeds the default `evaluation_templates` row.
3. Persists the chosen org back to `profiles`.

[`Auth.tsx`](src/pages/Auth.tsx) handles signin/signup/forgot. On signup it stashes the user-chosen org name in `user_metadata.pending_org_name`; `bootstrapOrganization` reads it back when creating the org. On password reset, the user is redirected to `/auth/recover` which calls `supabase.auth.updateUser({ password })`.

`bootstrapOrganization` generates the org UUID client-side so the insert doesn't need a `.select()` (which would fail RLS — at the moment of insert, the user isn't yet a member of the org they just created). This is the correct pattern; don't revert to `.insert(...).select()`.

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

`.env` is **already committed** in the repo with these three:

```
VITE_SUPABASE_PROJECT_ID="spklyeogyuoulcpgysme"
VITE_SUPABASE_URL="https://spklyeogyuoulcpgysme.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<the supabase anon JWT>"
```

The `PUBLISHABLE_KEY` is the Supabase **anon key**, which is safe to ship to the browser by design. Still — `.env` is not in `.gitignore`, and best practice is to add it. Use `.env.local` (already covered by `*.local` in `.gitignore`) or check in a `.env.example` instead.

### 3. Run

```bash
npm run dev      # http://localhost:8080 (per vite.config.ts)
npm run build    # production build to ./dist
npm run preview  # serve the build locally
npm run lint     # ESLint
npm run test     # Vitest (one-shot)
npm run test:watch
```

Playwright is configured but the config currently imports a Lovable-only package — see below.

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

## Things to verify before continuing development

- [ ] `npm install` succeeds (root deps look clean).
- [ ] `npm run dev` boots at http://localhost:8080 and the auth screen renders.
- [ ] Sign-in works against the existing Supabase project (`spklyeogyuoulcpgysme`).
- [ ] Decide: keep the existing Supabase project, or fork it under your own account?
  - If keeping: you only need to confirm you have access to the Supabase dashboard.
  - If forking: create a new Supabase project, run the 5 migrations in order, regenerate `src/integrations/supabase/types.ts`, update `.env`.
