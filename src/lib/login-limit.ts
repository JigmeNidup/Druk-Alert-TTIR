const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

const failures = new Map<string, { count: number; resetAt: number }>();

function entry(username: string) {
  const key = username.trim().toLowerCase();
  const current = failures.get(key);
  if (!current || current.resetAt < Date.now()) return { key, current: undefined };
  return { key, current };
}

export function tooManyLoginAttempts(username: string) {
  return (entry(username).current?.count ?? 0) >= MAX_FAILURES;
}

export function recordLoginFailure(username: string) {
  const { key, current } = entry(username);
  if (!current) {
    failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
    return;
  }
  current.count += 1;
}

export function clearLoginFailures(username: string) {
  failures.delete(username.trim().toLowerCase());
}
