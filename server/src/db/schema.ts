import {
  pgTable,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  serial,
  uuid,
  unique,
  numeric,
} from 'drizzle-orm/pg-core';

export const levels = pgTable('levels', {
  id: integer('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  subtitle: varchar('subtitle', { length: 500 }).notNull(),
  order: integer('order').notNull(),
  emoji: varchar('emoji', { length: 10 }).notNull(),
  isPublished: boolean('is_published').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const lessons = pgTable('lessons', {
  id: varchar('id', { length: 10 }).primaryKey(),
  levelId: integer('level_id').notNull().references(() => levels.id),
  title: varchar('title', { length: 200 }).notNull(),
  subtitle: varchar('subtitle', { length: 500 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  order: integer('order').notNull(),
  initialFs: jsonb('initial_fs'),
  initialDir: varchar('initial_dir', { length: 500 }),
  commandsIntroduced: jsonb('commands_introduced'),
  sections: jsonb('sections').notNull(),
  completionMessage: text('completion_message'),
  milestone: jsonb('milestone'),
  nextLesson: varchar('next_lesson', { length: 10 }),
  isPublished: boolean('is_published').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const palettes = pgTable('palettes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  colors: jsonb('colors').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('student'),
  email: varchar('email', { length: 255 }),
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  profileImage: text('profile_image'),
  paletteId: uuid('palette_id').references(() => palettes.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const progress = pgTable('progress', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: varchar('lesson_id', { length: 10 }).notNull().references(() => lessons.id),
  sectionIndex: integer('section_index').notNull().default(0),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  skipped: boolean('skipped').notNull().default(false),
  skippedAt: timestamp('skipped_at', { withTimezone: true }),
}, (table) => ({
  userLessonUnique: unique('progress_user_lesson_unique').on(table.userId, table.lessonId),
}));

export const siteSettings = pgTable('site_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const emailLog = pgTable('email_log', {
  id: serial('id').primaryKey(),
  emailType: varchar('email_type', { length: 50 }).notNull(),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  recipientUserId: uuid('recipient_user_id').references(() => users.id, { onDelete: 'set null' }),
  subject: varchar('subject', { length: 500 }).notNull(),
  resendId: varchar('resend_id', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const adminNotificationQueue = pgTable('admin_notification_queue', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const aiOnboardingPlans = pgTable('ai_onboarding_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  userPrompt: text('user_prompt').notNull(),
  plan: jsonb('plan').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiOnboardingLog = pgTable('ai_onboarding_log', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const triageRuns = pgTable('triage_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
  issuesProcessed: integer('issues_processed').notNull().default(0),
  autoFixed: integer('auto_fixed').notNull().default(0),
  needsReview: integer('needs_review').notNull().default(0),
  notABug: integer('not_a_bug').notNull().default(0),
  errors: integer('errors').notNull().default(0),
  totalCostUsd: numeric('total_cost_usd').notNull().default('0'),
  dryRun: boolean('dry_run').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const triageIssues = pgTable('triage_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => triageRuns.id, { onDelete: 'cascade' }),
  issueNumber: integer('issue_number').notNull(),
  issueUrl: text('issue_url').notNull(),
  title: text('title').notNull(),
  decision: varchar('decision', { length: 30 }).notNull(),
  confidence: varchar('confidence', { length: 10 }).notNull(),
  explanation: text('explanation').notNull(),
  reporterEmail: varchar('reporter_email', { length: 255 }),
  reporterName: varchar('reporter_name', { length: 255 }),
  prNumber: integer('pr_number'),
  prUrl: text('pr_url'),
  changedFiles: jsonb('changed_files'),
  costUsd: numeric('cost_usd').notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
