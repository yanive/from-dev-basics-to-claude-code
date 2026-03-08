import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(__dirname, '../..');

// Load agent/.env (if it exists)
loadDotenv({ path: path.resolve(__dirname, '../.env') });

// Auto-detect GitHub token from `gh auth token` (already authenticated on this machine)
function detectGitHubToken(): string | null {
  try {
    return execSync('gh auth token', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {}
  return null;
}

// Auto-detect owner/repo from git remote
function detectGitHubRepo(projectRoot: string): { owner: string; repo: string } | null {
  try {
    const url = execSync('git remote get-url origin', { cwd: projectRoot, encoding: 'utf-8' }).trim();
    // Handles: git@github.com:owner/repo.git  or  https://github.com/owner/repo.git
    const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) return { owner: match[1], repo: match[2] };
  } catch {}
  return null;
}

const detected = detectGitHubRepo(process.env.PROJECT_ROOT ?? defaultProjectRoot);
const detectedToken = detectGitHubToken();

const envSchema = z.object({
  // All three auto-detected from local machine — no manual config needed
  GITHUB_PAT: z.string().default(detectedToken ?? ''),
  GITHUB_OWNER: z.string().default(detected?.owner ?? ''),
  GITHUB_REPO: z.string().default(detected?.repo ?? ''),
  // API URL for POSTing triage results (server handles emails)
  API_URL: z.string().default('https://terminal-trainer-api.onrender.com'),
  PROJECT_ROOT: z.string().default(defaultProjectRoot),
  LOG_DIR: z.string().default(path.resolve(__dirname, '../logs')),
  DRY_RUN: z.string().default('false').transform(v => v === 'true'),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`Configuration error:\n${errors}`);
    process.exit(1);
  }
  if (!result.data.GITHUB_PAT) {
    console.error('No GitHub token found. Run `gh auth login` or set GITHUB_PAT in agent/.env');
    process.exit(1);
  }
  if (!result.data.GITHUB_OWNER || !result.data.GITHUB_REPO) {
    console.error('Could not detect GITHUB_OWNER/GITHUB_REPO from git remote. Set them in agent/.env');
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;
