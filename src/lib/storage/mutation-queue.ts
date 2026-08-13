// file: src/lib/storage/mutation-queue.ts

let storageMutationQueue: Promise<unknown> = Promise.resolve();

/**
 * Enqueues read-modify-write tasks sequentially to prevent race conditions
 * within a single service-worker lifetime. Note: this queue lives in memory
 * and resets on every MV3 service-worker restart/suspend — it protects
 * against concurrent calls while the worker is alive, not across restarts.
 */
export function enqueueStorageMutation<T>(
  mutationFn: () => Promise<T>,
): Promise<T> {
  const next = storageMutationQueue.then(mutationFn, mutationFn);
  storageMutationQueue = next.catch(() => {});
  return next;
}
