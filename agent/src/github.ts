import { Octokit } from '@octokit/rest';
import { config } from './config.js';
import { logger } from './logger.js';

const octokit = new Octokit({ auth: config.GITHUB_PAT });
const owner = config.GITHUB_OWNER;
const repo = config.GITHUB_REPO;

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: string[];
  created_at: string;
}

export async function getUnprocessedIssues(): Promise<GitHubIssue[]> {
  const { data } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    labels: 'bug,student-report',
    sort: 'created',
    direction: 'asc',
    per_page: 20,
  });

  return data
    .filter(issue => {
      const labelNames = issue.labels.map(l =>
        typeof l === 'string' ? l : l.name ?? ''
      );
      return !labelNames.includes('triage-processed');
    })
    .map(issue => ({
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      html_url: issue.html_url,
      labels: issue.labels.map(l => (typeof l === 'string' ? l : l.name ?? '')),
      created_at: issue.created_at,
    }));
}

export async function addComment(issueNumber: number, body: string): Promise<void> {
  if (config.DRY_RUN) {
    logger.info(`[DRY RUN] Would comment on #${issueNumber}: ${body.slice(0, 100)}...`);
    return;
  }
  await octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });
}

export async function addLabels(issueNumber: number, labels: string[]): Promise<void> {
  if (config.DRY_RUN) {
    logger.info(`[DRY RUN] Would add labels to #${issueNumber}: ${labels.join(', ')}`);
    return;
  }
  await octokit.issues.addLabels({ owner, repo, issue_number: issueNumber, labels });
}

export async function closeIssue(issueNumber: number): Promise<void> {
  if (config.DRY_RUN) {
    logger.info(`[DRY RUN] Would close #${issueNumber}`);
    return;
  }
  await octokit.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed' });
}

export async function createDraftPR(
  head: string,
  title: string,
  body: string,
): Promise<{ number: number; html_url: string }> {
  if (config.DRY_RUN) {
    logger.info(`[DRY RUN] Would create draft PR: ${title}`);
    return { number: 0, html_url: 'https://github.com/dry-run' };
  }
  const { data } = await octokit.pulls.create({
    owner,
    repo,
    head,
    base: 'main',
    title,
    body,
    draft: true,
  });
  return { number: data.number, html_url: data.html_url };
}
