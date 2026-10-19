# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is Bun (`bun.lock`), though scripts are plain npm-compatible.

- `npm run dev` — runs `tsx server.ts` (Express on port 3000 with Vite in middleware mode, serving both API and SPA)
- `npm run build` — `vite build` plus esbuild bundle of `server.ts` to `dist/server.cjs`
- `npm start` — runs `dist/server.cjs` (serves `dist/` statically)
- `npm run lint` — `tsc --noEmit` (the only static check; there is no test suite)

## Architecture

Spanish-language media-monitoring / reputation BI dashboard (Vite + React 19 + Tailwind 4 + Recharts frontend, Express backend, PostgreSQL data).

**One Express app, two entry points.** `src/serverApp.ts` defines all routes and exports the app. `server.ts` wraps it for local/container use (Vite middleware in dev, static `dist/` in prod; skips `listen` when a serverless env var is detected). `api/index.ts` re-exports it directly for Vercel (`vercel.json` rewrites `/api/*` to it and everything else to `index.html`). Add routes in `serverApp.ts` only. Server-side imports use `.js` extensions (e.g. `'../types/index.js'`); `src/services/postgres.ts` is server-only.

**Data sources.** The live source is read-only PostgreSQL (`src/services/postgres.ts`, ~1400 lines of SQL/query building: records, KPI stats, filters, perspectives, cumulative sentiment trends). The DB URL is read from one of many env var names (`DATABASE_URL`, `POSTGRES_URL`, …) with no hardcoded fallback. Google Sheets (`googleSheets.ts`, `sheetsParser.ts`; needs `GOOGLE_*` env vars) is the legacy "Phase 1" source, still used for users/auth and as fallback; `src/data/initialData.ts` holds seed data. See `.env.example`.

**Frontend data layer.** `src/services/repository.ts` is a singleton repository (`IMediaRepository`/`IAuthRepository`) that the UI calls; it talks to `/api/postgres/*` endpoints (`records`, `stats`, `filters`, `perspectives`, `perspectives/deepdive`, `trends/cumulative`) and `/api/auth/login`. Some routes are registered with and without the `/api` prefix.

**UI.** `src/App.tsx` is the large orchestrator: auth gate (`AuthContext`), `FilterState`, and a 3-way "perspective" reading model — Actores, Medios, Temas — plus the main monitor view (`PerspectiveViews`, `PerspectiveBannerFilters`, `ChartsSection`, `KPIGrid`, `DataTable`, modals). Default date range is 90 days. PDF export lives in `src/utils/generatePdfReport.ts` / `generatePerspectivePdf.ts` (jspdf + html2canvas).

**Domain conventions.**
- Types in `src/types/index.ts` (`Calificacion`: Positiva/Neutral/Negativa; roles admin/analista/lector). `src/types.ts` also exists — check which one a file imports.
- Topic categories come from `src/data/temasCatalogo.ts` (`CATEGORIAS_OFICIALES`, `matchesCategory`, …); use it rather than ad-hoc category strings.
- All date logic goes through `src/utils/dateUtils.ts` (`getOperationalTodayDate`, `getPresetDateRange`, …), which pins "today" to America/Mexico_City to avoid UTC rollover bugs. Don't use raw `new Date()` for filter ranges.
- `src/app/` (Next.js-style `page.tsx` files, `types/next.d.ts`) is vestigial; the real app is the Vite SPA via `src/main.tsx`/`App.tsx`.
