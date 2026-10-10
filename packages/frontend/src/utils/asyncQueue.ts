const queues = new Map<string, Promise<unknown>>();

/*eslint-disable unicorn/prefer-await, unicorn/prefer-then-catch*/

export function runSerialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(key, next.catch(console.error));
  return next;
}
