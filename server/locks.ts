// Serializes conflicting writes within the supported single API process.
export function createLocks() {
  const pending = new Map<string, Promise<void>>();
  return async function locked<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = pending.get(key) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    pending.set(key, current);
    await previous;
    try { return await action(); }
    finally { release(); if (pending.get(key) === current) pending.delete(key); }
  };
}
