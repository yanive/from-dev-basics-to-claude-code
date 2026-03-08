# From Zero to Claude Code — Project Context

## What This Is
An interactive web app teaching non-technical people how to use the terminal. 102 lessons across 8 levels.

**Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4 → Render Static Site
**Backend:** Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM → Render

**Live:** https://zero2claude.dev
**API:** https://terminal-trainer-api.onrender.com

## Current State

### Implemented
- **All 8 levels** (0–7): 102 lessons fully built and playable
- **9 interactive components**: NarrativeBlock, Quiz, FillInBlank, ClickMatch, InteractiveFileTree, PathBuilder, TerminalPreview, ProgramSimulator, TerminalStep
- **Terminal infrastructure**: Virtual filesystem (VFS), command parser, Terminal UI, FileExplorer sidebar, CommandReferenceBar
- **Backend**: Express API, PostgreSQL, JWT auth, progress tracking, admin CRUD
- **Auth**: Student login/register, dedicated admin login at `/admin/login`
- **Admin dashboard**: Stats, student list, level/lesson management, lesson editor, theme editor, palette manager, content validator, analytics, AI onboarding toggle + provider selection + usage stats
- **User dashboard** (`/dashboard`): Overview with smart continue, progress stats & streaks, 16 achievements with toast notifications, profile management (image upload, email, display name), password change, personalized learning plan view
- **AI onboarding** (`/onboarding/ai`): AI-powered personalized learning plan — user describes background, selected provider (Anthropic or Gemini) generates a plan highlighting priority levels and recommended lessons. Plan saved to DB, shown in dashboard, and surfaces "Recommended" badges on home screen. First-login modal prompts users to try it. Admin can toggle on/off, select provider, test provider connectivity, and monitor usage at `/admin/onboarding`
- **Collapsible dashboard sidebar**: Desktop arrow-toggle between full and icon-only mode (persisted to localStorage); mobile hamburger menu with slide-out drawer
- **Collapsible home screen modules**: Level cards collapsed by default showing only header + progress; click to expand lessons; auto-expands current lesson's level
- **Profile image upload**: Client-side resize to 200x200, stored as base64 in PostgreSQL; camera overlay on avatar hover, remove button
- **Achievement system**: 16 achievements (milestones, level mastery, streaks, speed) computed server-side, toast notifications on unlock
- **Color palette system**: Multiple palettes (DB-backed), user palette picker, admin palette CRUD at `/admin/palettes`, AI palette generation via selected provider (Anthropic or Gemini)
- **Theme system**: Admin theme editor with runtime CSS variable overrides persisted via `site_settings` table, applied globally on page load. Priority: CSS defaults → user palette → admin overrides
- **Mobile-responsive home screen**: Hamburger menu with dropdown (Dashboard + Logout) on mobile; icon-only controls; tighter layout for small screens
- **Dual-mode frontend**: Works with API (progress synced to DB) or without (localStorage fallback)
- **Deployment**: Render (frontend static site + backend web service + PostgreSQL), auto-deploy on push to `main`
- **Theme**: Dark terminal-noir aesthetic — void black palette (#09090B), electric orange accent (#FF6B35), Monaco font identity. Light mode also supported via palette/theme toggle
- **Test infrastructure**: Vitest for frontend (jsdom) and backend (supertest), 30+ tests across palette utils, hooks, and admin API endpoints

### Not Yet Implemented
- Real terminal/sandbox (xterm.js, WebContainers) — Level 1 uses in-memory VFS
- i18n

## Architecture
- `App.tsx` — React Router: `/` home, `/lesson/:id`, `/login`, `/register`, `/dashboard/*` (includes `/dashboard/plan`), `/onboarding/ai`, `/admin/login`, `/admin/*` (includes `/admin/palettes`, `/admin/onboarding`)
- `DashboardGuard.tsx` — redirects to `/login` if not authenticated (any role)
- `AdminGuard.tsx` — redirects to `/admin/login` if not authenticated as admin
- `AuthContext.tsx` — manages user state, token refresh, login/register/logout
- `AchievementContext.tsx` — manages achievement toast queue, provides `checkForNewAchievements()`
- `dataService.ts` — dual-mode: fetches from API or static JSON based on `VITE_USE_API`
- `LessonView.tsx` — orchestrates lesson flow, triggers achievement check on lesson completion
- `SectionRenderer.tsx` — routes section types to interactive components
- Theme defined in `src/index.css` via CSS custom properties in `@theme` block, overridable at runtime via admin theme editor

## Key Files
- `src/index.css` — all theme tokens, animations, and `.lesson-surface` override
- `src/contexts/AuthContext.tsx` — auth state provider
- `src/contexts/AchievementContext.tsx` — achievement toast queue
- `src/services/api.ts` — API client with auto token refresh
- `src/utils/theme.ts` — runtime theme application (fetches from API, applies CSS vars)
- `src/data/lessons/level{0-7}/` — 102 lesson JSON files
- `src/core/lesson/types.ts` — section type definitions
- `src/core/terminal/` — TerminalContext, CommandParser
- `src/components/dashboard/DashboardLayout.tsx` — dashboard shell: mobile hamburger/drawer + desktop sidebar orchestration
- `src/components/dashboard/DashboardSidebar.tsx` — extracted desktop sidebar with collapse toggle and nav icons
- `src/components/dashboard/DashboardProfile.tsx` — profile page with image upload, email, display name editing
- `server/src/index.ts` — Express entry point
- `server/src/db/schema.ts` — Drizzle table definitions (levels, lessons, users with email/profileImage/paletteId, progress, site_settings, palettes, ai_onboarding_plans, ai_onboarding_log, triage_runs, triage_issues)
- `server/src/routes/auth.ts` — auth endpoints including profile image upload (base64), email update, palette selection
- `server/src/routes/admin.ts` — admin CRUD for levels, lessons, settings, palettes (including AI generation), onboarding stats, provider API test endpoint
- `server/src/lib/aiClient.ts` — shared provider interface for Anthropic/Gemini calls + usage normalization
- `server/src/lib/paletteGenerator.ts` — AI palette generation via selected provider with rate limiting
- `src/components/admin/AdminPaletteManager.tsx` — admin palette list + editor + AI generate UI
- `src/components/home/HomeScreen.tsx` — home page with collapsible levels, mobile hamburger menu, AI onboarding CTA + first-login modal
- `src/hooks/useOnboardingPlan.ts` — shared hook for fetching user's AI onboarding plan + enabled state
- `src/components/onboarding/AIOnboarding.tsx` — full-page AI onboarding UI (standalone, not inside DashboardLayout)
- `src/components/dashboard/DashboardPlan.tsx` — dashboard plan view sorted by priority with lesson links
- `src/components/admin/AdminOnboardingStats.tsx` — admin AI onboarding toggle + usage stats
- `server/src/lib/onboardingGenerator.ts` — AI plan generation via selected provider with rate limiting (3/hour per user)
- `server/src/routes/onboarding.ts` — API routes: generate plan, get plan, check enabled
- `server/src/db/seed.ts` — seeds DB from lesson JSONs
- `server/src/lib/achievements.ts` — achievement registry (16 achievements)
- `server/src/routes/progress.ts` — progress, stats, achievements, smart continue endpoints
- `server/src/routes/triage.ts` — triage agent API: POST run results (PAT auth), GET runs/stats (admin JWT)
- `server/drizzle/` — committed migration SQL files
- `agent/src/index.ts` — triage agent entry point (single poll cycle, then exit)
- `agent/src/config.ts` — agent config (auto-detects GitHub token + repo from local machine)
- `agent/src/claudeAgent.ts` — Claude Code Agent SDK: investigate (read-only) + fix (write+git)
- `agent/src/github.ts` — agent GitHub client (Octokit: issues, labels, comments, draft PRs)
- `agent/src/reportResults.ts` — POSTs triage results to server API
- `agent/src/issueParser.ts` — parses structured bug report markdown from GitHub issues
- `specs/TRIAGE_AGENT_SPEC.md` — triage agent feature spec
- `specs/DEPLOYMENT_SPEC.md` — full deployment architecture
- `specs/USER_DASHBOARD_SPEC.md` — user dashboard spec (complete)
- `specs/TRIAGE_AGENT_SPEC.md` — local triage agent spec
- `agent/src/index.ts` — triage agent entry point (single poll cycle)
- `agent/src/claudeAgent.ts` — Claude Code Agent SDK integration (investigate + fix)
- `agent/src/github.ts` — Octokit wrapper for issues, labels, comments, PRs
- `agent/src/issueParser.ts` — parses structured bug report markdown from GitHub issues
- `agent/com.zero2claude.triage-agent.plist` — macOS launchd schedule (hourly)

## Dev Commands
```bash
npm run dev       # Start frontend dev server
npm run build     # TypeScript check + production build
npm test          # Run frontend tests (Vitest)

cd server
npm run dev       # Start backend with hot reload
npm run build     # Compile TypeScript
npm test          # Run backend tests (Vitest + supertest)
npm run db:migrate  # Apply migrations
npm run db:seed     # Seed database

cd agent
npm run build     # Compile triage agent
npm run start     # Run one triage cycle
npm run dev       # Run with tsx (no build needed)
```

## Deployment
- **Frontend:** Push to `main` → Render auto-builds static site, serves via CDN
- **Backend:** Push to `main` → Render auto-builds, migrates, seeds, restarts
- Frontend env vars set on Render static site: `VITE_USE_API=true`, `VITE_API_URL`, `VITE_TURNSTILE_SITE_KEY`
- Backend env vars on Render: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GITHUB_PAT`
- SPA routing: Render rewrite rule `/* → /index.html`
- See `specs/DEPLOYMENT_SPEC.md` for full details

## Important Notes
- The `--color-purple` CSS variable is actually electric orange (#FF6B35), not purple. This naming was kept from the original theme to avoid renaming every class reference. All `bg-purple`, `text-purple` etc. render as orange.
- Terminal/code blocks use hardcoded warm dark colors (#2D2B28 background, #38352F titlebar, #F0ECE4 text, #6ABF69 prompt green, #D4A843 highlight gold) — not theme tokens.
- The app defaults to dark theme; light/dark toggle is hidden for users. The `--font-mono` (Monaco) is used as the identity font for headings, labels, and code. `--font-sans` (system SF Pro) is used for body text.
- Palettes define 14 CSS tokens (4 backgrounds, 3 text, 5 accents, 2 borders) for both dark and light modes. Users select a palette; admins can create/edit/delete palettes and generate new ones via AI.
- Render free tier: service sleeps after 15min inactivity, ~30s cold start. Free Postgres expires after 30 days.
- Auth cookies use `sameSite: 'none'` for cross-origin (Render static site → Render API, different subdomains).
- Repo is private. Bug reports create GitHub Issues via server-side `GITHUB_PAT` (unaffected by repo visibility).
- Profile images are stored as base64 data URIs in the `profile_image` text column (users table). Client resizes to 200x200 before upload. Express body limit is 5mb.
- Dashboard sidebar state (collapsed/expanded) is persisted to `localStorage` key `dashboard-sidebar-collapsed`.
- AI palette generation and onboarding generation use a shared provider interface supporting `anthropic` and `gemini`. Anthropic uses `claude-sonnet-4-20250514`; Gemini uses `gemini-2.5-flash`.
- Rate limits remain in-memory: palettes 10 generations/hour per admin; onboarding 3 generations/hour per user.
- Onboarding plans are stored in `ai_onboarding_plans` (one per user, upserted), generation logs in `ai_onboarding_log`; admin usage endpoint now includes totals and provider-split usage (`usageByProvider`).
- Admin onboarding page includes provider test actions that call `POST /api/admin/onboarding/test-provider` before enabling for users.
- First-login AI onboarding modal uses `localStorage` key `ai-onboarding-modal-dismissed` to show once per user.
- Backend async route handlers must use `asyncHandler` wrapper (Express 4 doesn't catch async throws). All auth, palette, and onboarding routes are wrapped.
- **Triage agent** (`agent/`): Local Node.js agent that polls GitHub issues hourly, investigates bug reports by spawning Claude Code instances (via `@anthropic-ai/claude-code` Agent SDK), creates fix branches + draft PRs for valid bugs, comments/closes invalid ones. POSTs results to server which handles all email notifications (reporter + admin digest). Runs on macOS via launchd plist. Zero-config: auto-detects GitHub token from `gh auth token`, repo from git remote, Claude auth from local installation. `DRY_RUN=true` for safe testing. Bug report issue body includes reporter email (private repo).
