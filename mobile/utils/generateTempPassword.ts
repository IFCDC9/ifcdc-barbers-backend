/** Cryptographically styled temp password: 12+ chars with upper, lower, number, symbol. */
export function generateSecureTempPassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const nums = "23456789";
  const syms = "!@#$%&*-_+=";
  const all = upper + lower + nums + syms;

  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const required = [pick(upper), pick(lower), pick(nums), pick(syms)];
  const rest = Array.from({ length: Math.max(8, length - required.length) }, () => pick(all));
  const chars = [...required, ...rest];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
