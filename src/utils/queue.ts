import { logger } from '@/utils/logger';

type Handler<T> = (data: T) => Promise<void> | void;

/**
 * Minimal in-process job queue with Bull's add/process shape, so a
 * Redis-backed Bull queue can replace it later without call-site changes.
 * Jobs run on the next tick and failures are logged, never thrown.
 */
export class MemoryQueue<T = unknown> {
  private handler: Handler<T> | null = null;

  constructor(readonly name: string) {}

  process(handler: Handler<T>): void {
    this.handler = handler;
  }

  add(data: T): void {
    setImmediate(async () => {
      if (!this.handler) {
        logger.warn(`Queue ${this.name}: job dropped, no processor registered`);
        return;
      }
      try {
        await this.handler(data);
      } catch (err) {
        logger.error(`Queue ${this.name}: job failed`, { error: (err as Error).message });
      }
    });
  }
}

export const QUEUE_NAMES = ['notifications', 'receipts'] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

let queues: Map<QueueName, MemoryQueue> | null = null;

export function setupQueues(): void {
  queues = new Map(QUEUE_NAMES.map((name) => [name, new MemoryQueue(name)]));
}

export function getQueue<T = unknown>(name: QueueName): MemoryQueue<T> {
  if (!queues) throw new Error('Queues not initialized. Call setupQueues() first.');
  const queue = queues.get(name);
  if (!queue) throw new Error(`Unknown queue: ${name}`);
  return queue as MemoryQueue<T>;
}
