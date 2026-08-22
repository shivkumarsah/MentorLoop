/**
 * index.ts — Server entry point
 */

import 'dotenv/config';
import { createApp } from './app.js';

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);

const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.info(`🚀 MentorLoop server running on http://localhost:${PORT}`);
  console.info(`   Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
  console.info(`   CORS origin: ${process.env['CORS_ORIGIN'] ?? 'http://localhost:5173'}`);

  if (!process.env['GEMINI_API_KEY']) {
    console.warn(
      '⚠️  GEMINI_API_KEY is not set. AI features will fail. Copy .env.example to .env and add your key.'
    );
  }
});
