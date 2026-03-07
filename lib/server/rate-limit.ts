const localStore = new Map<string, number[]>();

export async function allowRate(key: string, limit: number, windowSeconds: number) {
  const now = Date.now() / 1000;
  const cutoff = now - windowSeconds;
  const current = localStore.get(key) ?? [];
  const next = current.filter((t) => t >= cutoff);
  next.push(now);
  localStore.set(key, next);
  return next.length <= limit;
}
