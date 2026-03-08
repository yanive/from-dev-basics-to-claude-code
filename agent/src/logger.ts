import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const LOG_DIR = config.LOG_DIR;

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `triage-${date}.log`);
}

function formatMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

function write(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  const formatted = formatMessage(level, message);

  // Console output
  if (level === 'ERROR') {
    console.error(formatted);
  } else if (level === 'WARN') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }

  // File output
  try {
    ensureLogDir();
    fs.appendFileSync(getLogFile(), formatted + '\n');
  } catch {
    // Don't crash if logging fails
  }
}

export const logger = {
  info: (message: string) => write('INFO', message),
  warn: (message: string) => write('WARN', message),
  error: (message: string) => write('ERROR', message),
};
