import { config } from './config.js';
import { logger } from './logger.js';
import type { TriageResult } from './types.js';

export async function reportResults(
  startedAt: string,
  finishedAt: string,
  results: TriageResult[],
): Promise<void> {
  if (config.DRY_RUN) {
    logger.info(`[DRY RUN] Would POST ${results.length} results to ${config.API_URL}`);
    return;
  }

  try {
    const res = await fetch(`${config.API_URL}/api/admin/triage/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.GITHUB_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startedAt,
        finishedAt,
        dryRun: false,
        issues: results,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error(`!!! Failed to POST results (${res.status}): ${body}`);
      logger.error(`!!! ${results.length} issues were processed but NOT recorded on server. Emails will NOT be sent.`);
      return;
    }

    logger.info(`Results posted to server (${results.length} issues)`);
  } catch (err) {
    logger.error(`!!! Failed to POST results to server: ${err}`);
    logger.error(`!!! ${results.length} issues were processed but NOT recorded on server. Emails will NOT be sent.`);
  }
}
