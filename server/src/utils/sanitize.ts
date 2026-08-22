/**
 * sanitize.ts
 *
 * Security utility to sanitize user inputs, strip malicious HTML/scripts,
 * and enforce strict validation boundaries.
 */

/**
 * Strips HTML tags, script delimiters, and null bytes from user input strings.
 * Enforces maximum character lengths to prevent memory-exhaustion DoS attacks.
 */
export function sanitizeString(input: unknown, maxLength = 300): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/\0/g, '') // remove null bytes
    .replace(/<[^>]*>/g, '') // strip HTML/script tags
    .replace(/[<>'"&]/g, (char) => {
      // Escape critical HTML entities
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case "'": return '&#39;';
        case '"': return '&quot;';
        case '&': return '&amp;';
        default: return char;
      }
    })
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates whether a UUID string matches standard v4 format.
 */
export function isValidUUID(uuid: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(uuid);
}
