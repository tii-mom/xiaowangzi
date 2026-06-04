import crypto from 'node:crypto';

export function generateBindCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export function generateCodeExpiry(hours = 1): string {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  return d.toISOString();
}
