import { createHash, randomBytes } from 'node:crypto';

/** API tokens are stored as sha256 digests; the plaintext exists only in the holder's CLI config. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateToken(): string {
  return `mct_${randomBytes(24).toString('base64url')}`;
}
