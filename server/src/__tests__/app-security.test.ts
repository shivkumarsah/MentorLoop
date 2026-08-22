import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { sanitizeString, isValidUUID } from '../utils/sanitize.js';

describe('Application Security & Headers', () => {
  const app = createApp();

  it('includes Helmet security headers on HTTP responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    // Helmet sets X-Content-Type-Options: nosniff
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    // Helmet sets X-Frame-Options: SAMEORIGIN
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    // Helmet sets Strict-Transport-Security in HTTPS or test env
    expect(res.headers['x-download-options']).toBe('noopen');
  });

  it('permits authorized CORS origins like localhost and .run.app', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://mentorloop-687233290294.us-central1.run.app');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://mentorloop-687233290294.us-central1.run.app'
    );
  });

  it('blocks unauthorized external CORS origins with an error', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://malicious-attacker-site.com');
    // Origin not in allowlist triggers CORS rejection / 500 error
    expect(res.status).toBe(500);
  });

  it('returns 404 for non-existent API routes', async () => {
    const res = await request(app).get('/api/non-existent-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route not found' });
  });

  it('rejects oversized JSON payloads exceeding the limit', async () => {
    const hugePayload = { topic: 'a'.repeat(25000) };
    const res = await request(app).post('/api/session').send(hugePayload);
    // 413 Payload Too Large or 400 Bad Request
    expect([400, 413, 500]).toContain(res.status);
  });
});

describe('Sanitization & Security Utilities', () => {
  it('strips malicious script tags from user inputs', () => {
    const dirty = '<script>alert("XSS")</script>Python basics';
    const clean = sanitizeString(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('</script>');
    expect(clean).toContain('Python basics');
  });

  it('escapes dangerous HTML characters', () => {
    const input = 'Photosynthesis & <plant> "growth"';
    const clean = sanitizeString(input);
    expect(clean).toContain('&amp;');
    expect(clean).toContain('&quot;');
  });

  it('validates UUID v4 properly', () => {
    expect(isValidUUID('fa8902bd-dfe6-4918-881d-013b81ef5f3d')).toBe(true);
    expect(isValidUUID('invalid-uuid-format-1234')).toBe(false);
  });
});
