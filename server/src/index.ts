import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './lib/env.js';
import { levelsRouter, lessonsRouter } from './routes/levels.js';
import { authRouter } from './routes/auth.js';
import { progressRouter } from './routes/progress.js';
import { adminRouter } from './routes/admin.js';
import { bugReportsRouter } from './routes/bugReports.js';
import { emailRouter } from './routes/email.js';
import { palettesRouter } from './routes/palettes.js';
import { onboardingRouter } from './routes/onboarding.js';
import { cronRouter } from './routes/cron.js';
import { triageRouter } from './routes/triage.js';
import { errorHandler } from './middleware/errorHandler.js';
import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { siteSettings } from './db/schema.js';

const app = express();

// CORS
const origins = env.CORS_ORIGIN.split(',').map(s => s.trim());
app.use(cors({
  origin: origins,
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Public settings (no auth required)
app.get('/api/settings/theme', async (_req, res) => {
  const [row] = await db.select().from(siteSettings)
    .where(eq(siteSettings.key, 'theme'));
  res.json(row ? row.value : null);
});

// Routes
app.use('/api/levels', levelsRouter);
app.use('/api/lessons', lessonsRouter);
app.use('/api/auth', authRouter);
app.use('/api/progress', progressRouter);
app.use('/api/admin/triage', triageRouter);
app.use('/api/admin', adminRouter);
app.use('/api/bug-reports', bugReportsRouter);
app.use('/api/email', emailRouter);
app.use('/api/palettes', palettesRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/cron', cronRouter);

// Error handler (must be last)
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
