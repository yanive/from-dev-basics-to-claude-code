import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('From Zero to Claude Code <noreply@zero2claude.dev>'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  CRON_SECRET: z.string().optional(),
  GITHUB_PAT: z.string().optional(),
});

export const env = envSchema.parse(process.env);
