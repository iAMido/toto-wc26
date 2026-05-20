/**
 * Generate a random 8-character alphanumeric invite code.
 * Uses only uppercase + digits to be easy to type and share verbally.
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid ambiguity
  let code = '';
  const arr = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) {
    code += chars[arr[i] % chars.length];
  }
  return code;
}
