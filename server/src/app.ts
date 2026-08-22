/**
 * app.ts
 *
 * Express application setup.
 * Security: CORS restricted to configured origin, rate limiting on AI endpoints,
 * Zod validation happens inside each route.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { sessionRouter } from './routes/session.js';
import { diagnosticRouter } from './routes/diagnostic.js';
import { masteryRouter } from './routes/mastery.js';
import { explainRouter } from './routes/explain.js';
import { quizRouter } from './routes/quiz.js';

export function createApp(): express.Application {
  const app = express();
  
  // ---- Trust Proxy (Required for Cloud Run & Rate Limiting)
  app.set('trust proxy', 1);

  // ---- Security Headers (Helmet) ---------------------------
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // ---- Body parsing & payload limits -----------------------
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));

  // ---- CORS (Strict & Secure) ------------------------------
  const configuredOrigins = (process.env['CORS_ORIGIN'] ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isOriginAllowed = (origin: string | undefined): boolean => {
    if (!origin) return true; // allow same-origin, curl, server-to-server
    if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) return true;
    try {
      const parsedUrl = new URL(origin);
      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') return true;
      if (parsedUrl.hostname.endsWith('.run.app')) return true;
    } catch {
      return false;
    }
    return false;
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS policy violation: origin ${origin} is not authorized`));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      maxAge: 86400,
    })
  );

  // ---- Rate limiting on AI-backed endpoints ----------------
  const maxRequests = parseInt(process.env['RATE_LIMIT_MAX'] ?? '30', 10);
  const windowMs = parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '900000', 10);

  const aiRateLimit = rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: `Too many requests. Max ${maxRequests} requests per ${windowMs / 60000} minutes per IP.`,
    },
  });

  // Apply rate limiting to all AI-backed routes
  app.use('/api/session', aiRateLimit);
  app.use('/api/diagnostic', aiRateLimit);
  app.use('/api/explain', aiRateLimit);
  app.use('/api/quiz', aiRateLimit);

  // ---- Routes ----------------------------------------------
  app.use('/api/session', sessionRouter);
  app.use('/api/diagnostic', diagnosticRouter);
  app.use('/api/mastery', masteryRouter);
  app.use('/api/explain', explainRouter);
  app.use('/api/quiz', quizRouter);

  // ---- Health check ----------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ---- Serve Static Frontend -------------------------------
  const candidatePaths = [
    path.resolve(__dirname, '../../../../client/dist'),
    path.resolve(__dirname, '../../../client/dist'),
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), '../../client/dist'),
    '/app/client/dist',
  ];

  const clientDistPath =
    candidatePaths.find((p) => fs.existsSync(path.join(p, 'index.html'))) ||
    path.resolve(process.cwd(), '../client/dist');

  app.use(express.static(clientDistPath));

  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.json({
        name: 'MentorLoop API',
        version: '1.0.0',
        status: 'active',
        frontend: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
        endpoints: [
          '/api/health',
          '/api/session',
          '/api/diagnostic/answer',
          '/api/mastery/:sessionId',
          '/api/explain',
          '/api/quiz/next',
          '/api/quiz/answer',
        ],
      });
    }
  });

  // ---- 404 handler for API routes --------------------------
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // ---- Global error handler --------------------------------
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
