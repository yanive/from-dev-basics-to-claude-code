# Local Triage Agent — Feature Spec

## What It Is

A local Node.js agent that runs on your Mac, polls GitHub issues on a schedule, and autonomously triages student bug reports. It investigates each report by spawning a **Claude Code instance** (via the Claude Agent SDK), determines validity, and takes action: creating fix branches + draft PRs for valid bugs, or commenting + closing invalid ones. Reporters and the admin get email updates at every step.

## Problem It Solves

Bug reports from students pile up in GitHub Issues. Each one requires manual investigation: reading the report, checking the relevant lesson JSON, component code, and validation logic, then deciding if it's a real bug. This agent automates the triage loop so you only need to review proposed PRs and merge.

## User Stories

1. **Student submits a bug** — agent picks it up within an hour, investigates, and either fixes it (draft PR) or closes it with an explanation
2. **You review PRs** — draft PRs from the agent appear in GitHub, you review and merge/reject as normal
3. **Student gets notified** — reporter receives an email: "fix created", "confirmed, under review", or "not a bug"
4. **You get a digest** — after each triage cycle, admin receives an email summarizing all issues processed, decisions made, and PRs created
5. **You monitor via admin page** — `/admin/triage` shows every run, every issue processed, decisions, costs, and PR links. No need to check log files.
6. **You have local logs too** — daily log files in `agent/logs/` for debugging if the agent can't reach the server

## Behavior

### Issue Selection

- Polls GitHub Issues API for open issues with labels `bug` AND `student-report`, WITHOUT label `triage-processed`
- Processes issues in chronological order (oldest first)
- Adds `triage-processed` label after handling each issue (prevents re-processing)

### Investigation (via Claude Code Agent SDK)

- Parses the structured markdown body (created by `server/src/routes/bugReports.ts`)
- Spawns a Claude Code instance (`@anthropic-ai/claude-agent-sdk`) in **read-only mode** (`Read`, `Glob`, `Grep` tools only)
- Claude Code reads the project's `CLAUDE.md`, navigates the codebase, reads lesson JSONs, component code, and validation logic
- Returns a structured JSON verdict: valid/invalid, confidence level, category, affected files, whether it can auto-fix

### Three Outcomes

| Outcome | Condition | Actions |
|---------|-----------|---------|
| **Auto-fix** | Valid bug, high/medium confidence, auto-fixable | Spawn Claude Code (write+git mode) to create branch, fix code, commit, push. Orchestrator opens draft PR via Octokit. Comment on issue with PR link. Email reporter "fix created". Email admin in digest. |
| **Human review** | Valid bug, but low confidence or not auto-fixable | Comment investigation findings on issue. Add `needs-human-review` label. Email reporter "confirmed, under review". Email admin in digest. |
| **Not a bug** | Invalid report | Comment explanation on issue. Add `not-a-bug` label. Close issue. Email reporter "not a bug — here's why". Email admin in digest. |

### Email Notifications (Server-Side)

The agent itself does **not** send emails. After each triage cycle, it POSTs results to the server (`POST /api/admin/triage/runs`). The server handles all email notifications using its existing Resend infrastructure and terminal-noir themed templates.

**To reporter** (per-issue, if email available in issue body):
- **Fix created**: "We've investigated your report and created a fix. It will be reviewed shortly."
- **Needs human review**: "We've confirmed the issue and flagged it for review."
- **Not a bug**: "We investigated and determined this isn't a bug. Here's why: {explanation}"

**To admin** (via existing admin notification system, immediate mode):
- **Summary digest**: lists all issues processed — issue number, title, decision badge, PR link if created
- Totals: N issues processed, X auto-fixed, Y needs review, Z not-a-bug
- Total Claude Code cost for the cycle
- Configured via admin notification settings (recipients + enabled/disabled)

### Scheduling

- macOS `launchd` plist — runs every hour (configurable via `StartInterval`)
- Each invocation: single poll cycle → process all unprocessed issues → exit
- No long-running process; launchd handles re-launching
- `RunAtLoad: true` — runs immediately when loaded

### Safety

- `DRY_RUN` mode: logs all decisions without executing any actions (for testing)
- Draft PRs only (never auto-merges)
- All git operations on fresh branches from `origin/main` — never touches your working tree state
- Low-confidence bugs never get auto-fixed (routed to human review instead)
- `triage-processed` label prevents duplicate processing
- Claude Code tools are explicitly whitelisted per phase (read-only for investigation, write+git for fixing)

## Data Flow

### Input: GitHub Issue Body

Created by `server/src/routes/bugReports.ts` `formatIssueBody()`. Format:

```markdown
## Student Bug Report

**Lesson:** {lessonId} — {title} (Section {idx}/{total})
**Reported by:** {username} ({email}) (ID: {userId})
**Date:** {timestamp}

### Description
> {description}

### Expected Behavior (optional)
> {expected}

---

### Auto-Gathered Context

**Current instruction:**
> {instruction}

**Validation rule:** `{type}` → `{value}`

**Terminal History (last 30 lines):**
```
{history}
```

**Last command:** `{command}`

**Filesystem State:**
```json
{vfsState}
```

**Current directory:** `{cwd}`

**Environment:**
- Browser: {browser}
- Screen: {screenSize}
- Theme: {themeMode}
```

### Required Change: Embed Reporter Email

Reporter email is currently NOT in the issue body (only username + userId). The agent runs locally without DB access, so it needs the email embedded in the issue body.

**Change:** Modify `server/src/routes/bugReports.ts` `formatIssueBody()` to include email in the `Reported by` line:
```
**Reported by:** username (email@example.com) (ID: uuid)
```

This is acceptable because the repo is private.

## Edge Cases

1. **No reporter email** — skip email notification for that reporter, log warning
2. **Issue body doesn't match expected format** — log parse error, add `triage-parse-error` label, skip issue
3. **Claude Code agent errors** (timeout, API failure, malformed output) — retry once, then route to human review
4. **Git push fails** (e.g. branch name conflict) — log error, comment on issue about failure, add `needs-human-review`
5. **Resend API down** — log error, continue (email is best-effort, never blocks triage)
6. **Rate limits** (GitHub API, Anthropic API) — respect rate limit headers, back off and retry
7. **Large number of issues** — process sequentially with delays between API calls

## Admin Dashboard Page (`/admin/triage`)

### Data Flow: Agent → Server → Admin UI

The agent runs locally but the admin page lives in the web app on Render. After each triage cycle, the agent POSTs run results to the server API, which stores them in PostgreSQL. The admin page reads from the same API.

```
Local agent                    Render server              Admin browser
───────────                    ────────────               ─────────────
run triage cycle
  → results[]
  → POST /api/admin/triage/runs   → insert into DB
                                   GET /api/admin/triage/runs  ← admin page
                                     → return runs + issues    → render UI
```

Auth: the POST endpoint verifies the `Authorization: Bearer <GITHUB_PAT>` header matches the server's own `GITHUB_PAT` env var. Both sides already have this token — no new secrets needed.

### Database Tables

**`triage_runs`** — one row per agent cycle:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `started_at` | timestamp | When the cycle started |
| `finished_at` | timestamp | When the cycle ended |
| `issues_processed` | integer | Total issues in this run |
| `auto_fixed` | integer | Count of auto-fixed |
| `needs_review` | integer | Count of needs-review |
| `not_a_bug` | integer | Count of not-a-bug |
| `errors` | integer | Count of failed issues |
| `total_cost_usd` | numeric | Total Claude Code cost |
| `dry_run` | boolean | Whether this was a dry run |

**`triage_issues`** — one row per issue processed:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `run_id` | uuid | FK → triage_runs |
| `issue_number` | integer | GitHub issue number |
| `issue_url` | text | GitHub issue URL |
| `title` | text | Issue title |
| `decision` | text | `auto-fixed`, `needs-review`, `not-a-bug`, `error` |
| `confidence` | text | `high`, `medium`, `low` |
| `explanation` | text | Claude's explanation |
| `pr_number` | integer | PR number (if auto-fixed) |
| `pr_url` | text | PR URL (if auto-fixed) |
| `changed_files` | text[] | Files changed (if auto-fixed) |
| `cost_usd` | numeric | Claude Code cost for this issue |
| `created_at` | timestamp | When this issue was processed |

### API Endpoints

**`POST /api/admin/triage/runs`** — called by the local agent after each cycle
- Auth: `Authorization: Bearer <GITHUB_PAT>` — server verifies it matches its own `GITHUB_PAT`
- Body: `{ startedAt, finishedAt, dryRun, issues: TriageResult[] }`
- Inserts run + issues into DB

**`GET /api/admin/triage/runs`** — called by admin page
- Auth: admin JWT
- Query params: `?limit=20&offset=0`
- Returns runs with nested issues, ordered by most recent

**`GET /api/admin/triage/stats`** — aggregate stats for admin page
- Auth: admin JWT
- Returns: total runs, total issues processed, breakdown by decision, total cost, avg cost per issue, last run timestamp

### Admin UI (`/admin/triage`)

**Header section:**
- Total runs, total issues processed, total cost
- Breakdown bar: auto-fixed / needs-review / not-a-bug (color-coded)
- Last run timestamp + next expected run

**Run history table:**
- Each row: timestamp, issues count, decision breakdown (colored chips), cost, dry run badge
- Click to expand → shows individual issues in that run

**Expanded run detail:**
- Per-issue rows: issue # (link to GitHub), title, decision badge, confidence, PR link (if exists), cost
- Explanation text on hover or expand

**Empty state:** "No triage runs recorded yet. The agent will report here after its first cycle."

## Configuration

All configuration is auto-detected from your local machine. The `.env` file is only needed to override defaults or enable email.

| Variable | Auto-detected from | Override in `.env` |
|----------|-------------------|-------------------|
| GitHub token | `gh auth token` | `GITHUB_PAT` |
| Repo owner/name | `git remote get-url origin` | `GITHUB_OWNER` / `GITHUB_REPO` |
| Anthropic auth | Local Claude Code installation | Not needed |
| `RESEND_API_KEY` | — | For email notifications |
| `ADMIN_EMAIL` | — | Admin digest recipient |
| `DRY_RUN` | — | `true` for log-only mode |

The `agent/.env` file is gitignored so secrets never get committed.

## Architecture

```
agent/
├── src/
│   ├── index.ts           # Entry point — single poll cycle, then exit
│   ├── config.ts          # Zod-validated env config
│   ├── github.ts          # Octokit wrapper (issues, labels, comments, PRs)
│   ├── issueParser.ts     # Parse bug report markdown → ParsedBugReport
│   ├── claudeAgent.ts     # Claude Code Agent SDK (investigate + fix)
│   ├── reportResults.ts   # POST results to server (server handles emails)
│   ├── logger.ts          # File + console logger
│   └── types.ts           # Shared interfaces
├── package.json
├── tsconfig.json
├── .env.example
└── com.zero2claude.triage-agent.plist
```

## Pipeline Flow

```
launchd triggers agent (every hour)
       │
       ▼
Load config, init logger
       │
       ▼
Fetch unprocessed issues (bug + student-report, no triage-processed)
       │
       ▼
For each issue (sequential):
       │
  Parse bug report → ParsedBugReport
       │
  Spawn Claude Code (read-only) → Investigate → TriageResult
       │
       ├── !isValidBug
       │     → Comment explanation, add "not-a-bug", close issue
       │
       ├── isValidBug, !canAutoFix
       │     → Comment findings, add "needs-human-review"
       │
       └── isValidBug, canAutoFix
             → Spawn Claude Code (write+git)
             → Claude creates branch, fixes, commits, pushes
             → Orchestrator creates draft PR via Octokit
             → Comment on issue with PR link
             → Add "fix-proposed" label
       │
  Add "triage-processed" label
       │
       ▼
POST run results to server API
  → Server stores in PostgreSQL (visible on /admin/triage)
  → Server sends reporter emails (fix created / confirmed / not a bug)
  → Server sends admin digest email via admin notification system
       │
       ▼
Exit (launchd will re-launch next hour)
```
