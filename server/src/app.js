import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config from './config/index.js';
import apiRoutes from './routes/index.js';
import { apiLimiter } from './shared/middlewares/rateLimit.middleware.js';
import errorHandler, { notFound } from './shared/middlewares/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Security headers (CSP relaxed for Electron + Vite SPA assets)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);

// --- CORS (Electron + Vite) ---
const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const allowedOrigins =
  config.corsOrigins.length > 0 ? config.corsOrigins : defaultDevOrigins;

function isOriginAllowed(origin) {
  // Electron BrowserWindow / same-origin requests often have no Origin header
  if (!origin) return true;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
  // Dev only: any localhost / 127.0.0.1 port (Vite may change port)
  if (
    config.env !== 'production' &&
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  ) {
    return true;
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Network-Status'],
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

// Welcome / status — not on "/" so SPA can own the root when packaged
app.get('/api/status', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the FluxOne API server',
  });
});

// Rate-limit all /api traffic (auth routes add a stricter limiter)
app.use('/api', apiLimiter, apiRoutes);

// --- Desktop: serve React build from same Express (same-origin) ---
const clientDistCandidates = [
  process.env.CLIENT_DIST_PATH
    ? path.resolve(process.env.CLIENT_DIST_PATH)
    : null,
  path.resolve(path.join(__dirname, '../../client/dist')),
].filter(Boolean);

const clientDist = clientDistCandidates.find((dir) =>
  fs.existsSync(path.join(dir, 'index.html')),
);

if (clientDist) {
  console.log(`Serving UI from ${clientDist}`);
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // Dev (Vite serves UI) or missing package — keep "/" informative
  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'FluxOne API server running (no client build found — dev mode?)',
    });
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
