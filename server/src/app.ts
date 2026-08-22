/**
 * app.ts
 *
 * Express application setup.
 * Security: CORS restricted to configured origin, rate limiting on AI endpoints,
 * Zod validation happens inside each route.
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import path from 'path';
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

  // ---- Body parsing ----------------------------------------
  app.use(express.json({ limit: '10kb' })); // limit payload size

  // ---- CORS ------------------------------------------------
  // Restricted to the configured origin — never wildcarded carelessly.
  const allowedOrigins = (process.env['CORS_ORIGIN'] ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, curl) in development
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: false,
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
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) {
        // If client/dist/index.html is not found (e.g. dev mode without build), return API info
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
