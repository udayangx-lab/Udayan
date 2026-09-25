import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';

// scrypt with a per-password salt. Format: scrypt$N$salt$hash (base64url).
const cost = 16384;
export const minPasswordLength = 10;

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, {N: cost, r: 8, p: 1});
  return `scrypt$${cost}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, n, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password, Buffer.from(salt, 'base64url'), expected.length, {N: Number(n), r: 8, p: 1});
  return timingSafeEqual(actual, expected);
}

export function passwordProblem(password: string) {
  if (password.length < minPasswordLength) return `Use at least ${minPasswordLength} characters.`;
  if (password.length > 200) return 'Use 200 characters or fewer.';
  return null;
}
