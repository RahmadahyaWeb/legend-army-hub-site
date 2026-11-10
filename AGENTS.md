# AGENTS.md

Guidance for coding agents working in this repo.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the repo root and `docs/adr/`. See `docs/agents/domain.md`.

### Supabase

This repo is Supabase-backed (Postgres + RLS + Auth). Load the `supabase` skill for any Supabase task, and `supabase-postgres-best-practices` before writing SQL, migrations, RLS policies, or indexes. Schema changes live in `supabase/migrations/` (imperative, one file per change); RLS proofs in `supabase/tests/rls_anon_write.sql`. Apply SQL with the Supabase MCP server (`execute_sql`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
