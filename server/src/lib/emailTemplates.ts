const STYLES = {
  bg: '#09090B',
  card: '#141419',
  accent: '#FF6B35',
  text: '#E8E5E0',
  muted: '#6B6B6B',
  border: '#2A2A2E',
  fontStack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${STYLES.bg};font-family:${STYLES.fontStack};">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${STYLES.bg};padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background-color:${STYLES.card};border-radius:12px;border:1px solid ${STYLES.border};overflow:hidden;">
<tr><td style="padding:32px 40px;">
${content}
</td></tr>
</table>
<table width="560" cellpadding="0" cellspacing="0">
<tr><td style="padding:24px 40px;text-align:center;">
<p style="margin:0;font-size:12px;color:${STYLES.muted};font-family:${STYLES.fontStack};">From Zero to Claude Code</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background-color:${STYLES.accent};border-radius:8px;padding:12px 28px;">
<a href="${url}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;font-family:${STYLES.fontStack};">${text}</a>
</td></tr>
</table>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${STYLES.text};font-family:${STYLES.fontStack};">${text}</h1>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${STYLES.text};font-family:${STYLES.fontStack};">${text}</p>`;
}

function mutedText(text: string): string {
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${STYLES.muted};font-family:${STYLES.fontStack};">${text}</p>`;
}

export function welcomeTemplate(displayName: string, appUrl: string): string {
  return layout(`
${heading(`Welcome, ${displayName}!`)}
${paragraph("You've just joined <strong>From Zero to Claude Code</strong> — an interactive course that teaches you how to use the terminal, Git, APIs, and AI-powered development tools.")}
${paragraph("Start with Level 1 and work your way through 9 levels of hands-on lessons. No prior experience needed.")}
${ctaButton('Start Learning', appUrl)}
${mutedText("If you didn't create this account, you can safely ignore this email.")}
  `);
}

export function verificationTemplate(displayName: string, verifyUrl: string): string {
  return layout(`
${heading('Verify your email')}
${paragraph(`Hi ${displayName}, please verify your email address by clicking the button below.`)}
${ctaButton('Verify Email', verifyUrl)}
${mutedText("This link expires in 24 hours. If you didn't request this, you can safely ignore this email.")}
  `);
}

export function passwordResetTemplate(displayName: string, resetUrl: string): string {
  return layout(`
${heading('Reset your password')}
${paragraph(`Hi ${displayName}, we received a request to reset your password. Click the button below to choose a new one.`)}
${ctaButton('Reset Password', resetUrl)}
${mutedText("This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.")}
  `);
}

export function bugSubmittedTemplate(displayName: string, issueNumber: number): string {
  return layout(`
${heading('Bug report received')}
${paragraph(`Thanks ${displayName}! Your bug report has been submitted and assigned issue <strong>#${issueNumber}</strong>.`)}
${paragraph("We'll look into it. You don't need to do anything else — just keep learning!")}
${mutedText("This is an automated confirmation. No reply is needed.")}
  `);
}

// ---------------------------------------------------------------------------
// Admin notification templates
// ---------------------------------------------------------------------------

export function adminStudentJoinedTemplate(displayName: string, email: string | null): string {
  const emailLine = email ? ` (<strong>${email}</strong>)` : '';
  return layout(`
${heading('New student joined')}
${paragraph(`<strong>${displayName}</strong>${emailLine} just created an account.`)}
${mutedText(`Sent at ${new Date().toUTCString()}`)}
  `);
}

export function adminBugReportTemplate(title: string, issueUrl: string, reportedBy: string): string {
  return layout(`
${heading('New bug report')}
${paragraph(`<strong>${reportedBy}</strong> submitted a bug report:`)}
${paragraph(`<em>${title}</em>`)}
${ctaButton('View on GitHub', issueUrl)}
${mutedText(`Sent at ${new Date().toUTCString()}`)}
  `);
}

// ---------------------------------------------------------------------------
// Triage agent notification templates
// ---------------------------------------------------------------------------

export function triageFixCreatedTemplate(displayName: string, issueNumber: number, prUrl: string): string {
  return layout(`
${heading('Your bug report has a fix')}
${paragraph(`Hi ${displayName}, we've investigated your bug report (<strong>#${issueNumber}</strong>) and created a fix. It will be reviewed and integrated shortly.`)}
${ctaButton('View Fix', prUrl)}
${mutedText("This is an automated notification from the triage agent.")}
  `);
}

export function triageNeedsReviewTemplate(displayName: string, issueNumber: number): string {
  return layout(`
${heading('Bug report confirmed')}
${paragraph(`Hi ${displayName}, we've confirmed the issue in your bug report (<strong>#${issueNumber}</strong>) and flagged it for manual review.`)}
${paragraph("A team member will look into it. No action needed on your end.")}
${mutedText("This is an automated notification from the triage agent.")}
  `);
}

export function triageNotABugTemplate(displayName: string, issueNumber: number, explanation: string): string {
  return layout(`
${heading('Bug report reviewed')}
${paragraph(`Hi ${displayName}, we investigated your bug report (<strong>#${issueNumber}</strong>) and determined this isn't a bug.`)}
${paragraph(`<strong>Details:</strong> ${explanation}`)}
${mutedText("If you believe this is incorrect, feel free to open a new report with additional details.")}
  `);
}

export interface TriageDigestIssue {
  issueNumber: number;
  title: string;
  decision: string;
  confidence: string;
  prUrl: string | null;
}

export function triageAdminDigestTemplate(issues: TriageDigestIssue[], totals: { autoFixed: number; needsReview: number; notABug: number; errors: number; totalCost: string }): string {
  const decisionBadge = (d: string) => {
    const colors: Record<string, string> = { 'auto-fixed': '#22c55e', 'needs-review': '#eab308', 'not-a-bug': '#6b7280' };
    const color = colors[d] || STYLES.muted;
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${color};">${d}</span>`;
  };

  const rows = issues.map(i => {
    const prLink = i.prUrl ? ` — <a href="${i.prUrl}" style="color:${STYLES.accent};">PR</a>` : '';
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid ${STYLES.border};font-size:13px;color:${STYLES.text};font-family:${STYLES.fontStack};">#${i.issueNumber}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${STYLES.border};font-size:13px;color:${STYLES.text};font-family:${STYLES.fontStack};">${i.title.slice(0, 60)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${STYLES.border};font-size:13px;">${decisionBadge(i.decision)}${prLink}</td>
    </tr>`;
  }).join('');

  return layout(`
${heading('Triage Agent Run Complete')}
${paragraph(`<strong>${issues.length}</strong> issue${issues.length === 1 ? '' : 's'} processed — ${totals.autoFixed} auto-fixed, ${totals.needsReview} needs review, ${totals.notABug} not a bug${totals.errors ? `, ${totals.errors} error${totals.errors === 1 ? '' : 's'}` : ''}`)}
${totals.totalCost !== '0' ? paragraph(`Total cost: <strong>$${totals.totalCost}</strong>`) : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
<tr>
  <th style="padding:6px 8px;text-align:left;font-size:12px;color:${STYLES.muted};border-bottom:1px solid ${STYLES.border};font-family:${STYLES.fontStack};">Issue</th>
  <th style="padding:6px 8px;text-align:left;font-size:12px;color:${STYLES.muted};border-bottom:1px solid ${STYLES.border};font-family:${STYLES.fontStack};">Title</th>
  <th style="padding:6px 8px;text-align:left;font-size:12px;color:${STYLES.muted};border-bottom:1px solid ${STYLES.border};font-family:${STYLES.fontStack};">Decision</th>
</tr>
${rows}
</table>
${mutedText(`Digest generated at ${new Date().toUTCString()}`)}
  `);
}

export interface DigestEvent {
  type: string;
  count: number;
  summaries: string[];
}

export function adminDigestTemplate(events: DigestEvent[]): string {
  const totalEvents = events.reduce((sum, e) => sum + e.count, 0);
  const eventSections = events.map(e => {
    const label = e.type === 'student_joined' ? 'New Students' : e.type === 'bug_report' ? 'Bug Reports' : e.type;
    const items = e.summaries.map(s => `• ${s}`).join('<br>');
    return `<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${STYLES.accent};font-family:${STYLES.fontStack};">${label} (${e.count})</p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${STYLES.text};font-family:${STYLES.fontStack};">${items}</p>`;
  }).join('');
  return layout(`
${heading(`Daily digest — ${totalEvents} event${totalEvents === 1 ? '' : 's'}`)}
${eventSections}
${mutedText(`Digest generated at ${new Date().toUTCString()}`)}
  `);
}
