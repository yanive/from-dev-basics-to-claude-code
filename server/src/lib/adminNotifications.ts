import { eq, isNull, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { siteSettings, adminNotificationQueue } from '../db/schema.js';
import { sendAndLog } from './email.js';
import {
  adminStudentJoinedTemplate,
  adminBugReportTemplate,
  adminDigestTemplate,
  type DigestEvent,
} from './emailTemplates.js';

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

export interface AdminEventConfig {
  enabled: boolean;
  mode: 'immediate' | 'digest';
}

export interface AdminNotificationConfig {
  recipients: string[];
  events: Record<string, AdminEventConfig>;
}

const DEFAULT_CONFIG: AdminNotificationConfig = {
  recipients: [],
  events: {
    student_joined: { enabled: true, mode: 'digest' },
    bug_report: { enabled: true, mode: 'immediate' },
    triage_run: { enabled: true, mode: 'immediate' },
  },
};

const CONFIG_KEY = 'admin_notifications';

// ---------------------------------------------------------------------------
// Config access
// ---------------------------------------------------------------------------

export async function getAdminNotificationConfig(): Promise<AdminNotificationConfig> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, CONFIG_KEY));
  if (!row) return { ...DEFAULT_CONFIG, events: { ...DEFAULT_CONFIG.events } };
  const stored = row.value as Partial<AdminNotificationConfig>;
  return {
    recipients: stored.recipients ?? DEFAULT_CONFIG.recipients,
    events: {
      ...DEFAULT_CONFIG.events,
      ...stored.events,
    },
  };
}

export async function saveAdminNotificationConfig(config: AdminNotificationConfig): Promise<void> {
  await db.insert(siteSettings)
    .values({ key: CONFIG_KEY, value: config })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Record an admin event (fire-and-forget entry point)
// ---------------------------------------------------------------------------

export async function recordAdminEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const config = await getAdminNotificationConfig();
    const eventConfig = config.events[eventType];

    if (!eventConfig?.enabled || config.recipients.length === 0) return;

    if (eventConfig.mode === 'immediate') {
      await sendImmediateNotification(eventType, payload, config.recipients);
    } else {
      await db.insert(adminNotificationQueue).values({ eventType, payload });
    }
  } catch (err) {
    console.error(`recordAdminEvent(${eventType}) error:`, err);
  }
}

// ---------------------------------------------------------------------------
// Immediate notification
// ---------------------------------------------------------------------------

async function sendImmediateNotification(
  eventType: string,
  payload: Record<string, unknown>,
  recipients: string[],
): Promise<void> {
  const { subject, html } = buildEmail(eventType, payload);

  for (const to of recipients) {
    await sendAndLog({ emailType: `admin_${eventType}`, to, subject, html });
  }
}

function buildEmail(eventType: string, payload: Record<string, unknown>): { subject: string; html: string } {
  switch (eventType) {
    case 'student_joined':
      return {
        subject: `New student: ${payload.displayName}`,
        html: adminStudentJoinedTemplate(
          payload.displayName as string,
          (payload.email as string | null) ?? null,
        ),
      };
    case 'bug_report':
      return {
        subject: `Bug report: ${(payload.title as string).slice(0, 60)}`,
        html: adminBugReportTemplate(
          payload.title as string,
          payload.issueUrl as string,
          payload.reportedBy as string,
        ),
      };
    case 'triage_run':
      return {
        subject: payload.subject as string,
        html: payload.html as string,
      };
    default:
      return {
        subject: `Admin event: ${eventType}`,
        html: `<p>Event: ${eventType}</p><pre>${JSON.stringify(payload, null, 2)}</pre>`,
      };
  }
}

// ---------------------------------------------------------------------------
// Digest processing
// ---------------------------------------------------------------------------

export async function processDigest(): Promise<number> {
  // Fetch all unprocessed events
  const pending = await db.select()
    .from(adminNotificationQueue)
    .where(isNull(adminNotificationQueue.processedAt))
    .orderBy(adminNotificationQueue.createdAt);

  if (pending.length === 0) return 0;

  const config = await getAdminNotificationConfig();
  if (config.recipients.length === 0) {
    // Mark as processed even with no recipients to avoid unbounded growth
    const ids = pending.map(r => r.id);
    for (const id of ids) {
      await db.update(adminNotificationQueue)
        .set({ processedAt: new Date() })
        .where(eq(adminNotificationQueue.id, id));
    }
    return 0;
  }

  // Group by event type
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const row of pending) {
    const list = grouped.get(row.eventType) || [];
    list.push(row.payload as Record<string, unknown>);
    grouped.set(row.eventType, list);
  }

  // Build digest events
  const digestEvents: DigestEvent[] = [];
  for (const [type, payloads] of grouped) {
    digestEvents.push({
      type,
      count: payloads.length,
      summaries: payloads.slice(0, 20).map(p => summarize(type, p)),
    });
  }

  // Send digest
  const html = adminDigestTemplate(digestEvents);
  const totalCount = pending.length;
  const subject = `Daily digest: ${totalCount} event${totalCount === 1 ? '' : 's'}`;

  for (const to of config.recipients) {
    await sendAndLog({ emailType: 'admin_digest', to, subject, html });
  }

  // Mark all as processed
  for (const row of pending) {
    await db.update(adminNotificationQueue)
      .set({ processedAt: new Date() })
      .where(eq(adminNotificationQueue.id, row.id));
  }

  return totalCount;
}

function summarize(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case 'student_joined':
      return `${payload.displayName}${payload.email ? ` (${payload.email})` : ''}`;
    case 'bug_report':
      return `${payload.title} — reported by ${payload.reportedBy}`;
    case 'triage_run':
      return `${payload.issueCount} issue${(payload.issueCount as number) === 1 ? '' : 's'}: ${payload.autoFixed} fixed, ${payload.needsReview} review, ${payload.notABug} not-a-bug`;
    default:
      return JSON.stringify(payload).slice(0, 100);
  }
}

// ---------------------------------------------------------------------------
// Queue viewer (for admin dashboard)
// ---------------------------------------------------------------------------

export async function getRecentQueueEntries(limit = 50) {
  return db.select()
    .from(adminNotificationQueue)
    .orderBy(desc(adminNotificationQueue.createdAt))
    .limit(limit);
}
