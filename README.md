# DiamondAudit

Multi-tenant baseball tryout & evaluation web app for coaches.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase credentials
npm run dev                  # http://localhost:8080
```

## Documentation

See [`CLAUDE.md`](./CLAUDE.md) for the full project overview: tech stack, file layout, data model, auth flow, and conventions.

## Stack

Vite · React 18 · TypeScript · Tailwind + shadcn/ui · React Router · TanStack Query · Supabase (Postgres + Auth + RLS)
