/**
 * High-Concurrency Priority Queue (Leaky Bucket) & Worker Pool - Task 2.1.2.1
 * Manages 4 priority tiers (CRITICAL, HIGH, MEDIUM, LOW) with a 30-worker parallel pool.
 */

import { PriorityLevel } from './decision_engine.js';

export class PriorityLeakyBucketQueue {
  /**
   * @param {Object} options
   * @param {number} [options.maxWorkers=30] - Maximum parallel workers in thread pool (default 30)
   * @param {number} [options.bucketCapacity=300] - Total queue capacity across all tiers
   */
  constructor(options = {}) {
    this.maxWorkers = options.maxWorkers || 30;
    this.bucketCapacity = options.bucketCapacity || 300;

    // 4 Priority Tier Queues
    this.queues = {
      [PriorityLevel.CRITICAL]: [],
      [PriorityLevel.HIGH]: [],
      [PriorityLevel.MEDIUM]: [],
      [PriorityLevel.LOW]: []
    };

    this.activeWorkers = 0;
    this.totalEnqueued = 0;
    this.totalProcessed = 0;
    this.totalDropped = 0;
  }

  /**
   * Returns total items currently waiting across all priority queues
   * @returns {number}
   */
  getPendingCount() {
    return (
      this.queues[PriorityLevel.CRITICAL].length +
      this.queues[PriorityLevel.HIGH].length +
      this.queues[PriorityLevel.MEDIUM].length +
      this.queues[PriorityLevel.LOW].length
    );
  }

  /**
   * Enqueues a query task into its designated priority tier (Task 2.1.2.1)
   * 
   * @param {Object} task
   * @param {string} task.id - Unique request ID
   * @param {string} [task.priority=PriorityLevel.LOW] - CRITICAL, HIGH, MEDIUM, LOW
   * @param {function(): Promise<any>} task.handler - Async execution handler function
   * @returns {Promise<any>} Resolves with handler result when processed by worker pool
   */
  enqueue(task) {
    return new Promise((resolve, reject) => {
      if (this.getPendingCount() >= this.bucketCapacity) {
        this.totalDropped++;
        return reject(new Error(`LEAKY_BUCKET_OVERFLOW: Queue capacity limit (${this.bucketCapacity}) exceeded.`));
      }

      const priority = task.priority && this.queues[task.priority] ? task.priority : PriorityLevel.LOW;

      const queueItem = {
        id: task.id || `JOB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        priority,
        handler: task.handler,
        enqueuedAt: Date.now(),
        resolve,
        reject
      };

      this.queues[priority].push(queueItem);
      this.totalEnqueued++;

      // Trigger worker pool processing check
      this.drainNext();
    });
  }

  /**
   * Drains the highest priority pending item from queues when workers are available
   * @private
   */
  drainNext() {
    if (this.activeWorkers >= this.maxWorkers) {
      return; // Worker pool full (30 active workers busy)
    }

    // Select job from highest priority non-empty queue tier
    let selectedJob = null;
    const priorityOrder = [
      PriorityLevel.CRITICAL,
      PriorityLevel.HIGH,
      PriorityLevel.MEDIUM,
      PriorityLevel.LOW
    ];

    for (const tier of priorityOrder) {
      if (this.queues[tier].length > 0) {
        selectedJob = this.queues[tier].shift();
        break;
      }
    }

    if (!selectedJob) return; // No pending jobs

    this.activeWorkers++;

    // Execute job using worker slot
    (async () => {
      try {
        const result = await selectedJob.handler();
        this.totalProcessed++;
        selectedJob.resolve(result);
      } catch (err) {
        selectedJob.reject(err);
      } finally {
        this.activeWorkers--;
        // Drains next job immediately upon worker availability
        this.drainNext();
      }
    })();
  }
}
