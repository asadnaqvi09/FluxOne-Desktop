import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  AUTH_TTL_HOURS,
  IDLE_MINUTES,
  VARIANCE_PIN_THRESHOLD,
} from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  sqlitePath: process.env.SQLITE_PATH || './data/fluxone.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || `${AUTH_TTL_HOURS}h`,
  authTtlHours: Number(process.env.AUTH_TTL_HOURS) || AUTH_TTL_HOURS,
  idleMinutes: Number(process.env.IDLE_MINUTES) || IDLE_MINUTES,
  variancePinThreshold:
    Number(process.env.VARIANCE_PIN_THRESHOLD) || VARIANCE_PIN_THRESHOLD,
  isOnline: String(process.env.NETWORK_ONLINE || 'true') !== 'false',
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Force Secure cookies even in development (needs HTTPS)
  cookieSecure: String(process.env.COOKIE_SECURE || 'false') === 'true',
};

export default config;