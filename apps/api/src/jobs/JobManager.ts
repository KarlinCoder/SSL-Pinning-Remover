import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { AppError, toJobError } from '../lib/errors.js';
import { Job } from './Job.js';
import { runJob } from './pipeline.js';

export class JobManager {
  private readonly jobs = new Map<string, Job>();
  private readonly queue: Job[] = [];
  private readonly active = new Set<Job>();
  private cleanupTimer?: NodeJS.Timeout;
  private shuttingDown = false;

  async init(): Promise<void> {
    await fs.mkdir(config.jobsDir, { recursive: true });
    await this.cleanupOrphaned();

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpired();
    }, 60_000);
    this.cleanupTimer.unref();
  }

  create(inputUrl: string): Job {
    if (this.queue.length >= config.maxQueueLength) {
      throw new AppError(
        'QUEUE_FULL',
        429,
        'Hay demasiados trabajos en cola.',
        'Espera a que terminen los trabajos actuales e inténtalo de nuevo.',
      );
    }

    const job = new Job(inputUrl);
    this.jobs.set(job.id, job);
    this.queue.push(job);
    this.updateQueuePositions();
    job.log('info', 'Trabajo en cola.');
    this.pump();
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  cancel(id: string): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    if (job.isTerminal) return job;

    job.abort('cancelled');

    const queueIndex = this.queue.indexOf(job);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
      this.updateQueuePositions();
      job.cancel();
    }

    return job;
  }

  remove(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (!job.isTerminal) {
      throw new AppError(
        'JOB_ACTIVE',
        409,
        'El trabajo sigue en curso.',
        'Cancélalo antes de eliminarlo.',
      );
    }

    this.jobs.delete(id);
    job.closeSse();
    void fs.rm(job.jobDir, { recursive: true, force: true }).catch(() => undefined);
    return true;
  }

  stats(): { active: number; queued: number; total: number } {
    return {
      active: this.active.size,
      queued: this.queue.length,
      total: this.jobs.size,
    };
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

    for (const job of this.active) {
      job.abort('shutdown');
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    for (const job of this.jobs.values()) {
      job.closeSse();
    }
  }

  private updateQueuePositions(): void {
    this.queue.forEach((job, index) => {
      job.queuePosition = index + 1;
      job.setStatus('queued', 'queued', 0);
    });
  }

  private pump(): void {
    if (this.shuttingDown) return;

    while (
      this.active.size < config.maxConcurrentJobs &&
      this.queue.length > 0
    ) {
      const job = this.queue.shift();
      if (!job) break;

      job.queuePosition = undefined;
      this.updateQueuePositions();
      this.active.add(job);
      void this.run(job);
    }
  }

  private async run(job: Job): Promise<void> {
    job.startedAt = new Date();
    job.setStatus('downloading', 'download', 2);
    job.log('info', 'Trabajo iniciado.');

    const timeout = setTimeout(() => {
      if (job.isTerminal) return;
      job.log(
        'error',
        'Se superó el tiempo máximo de procesamiento. Cancelando...',
      );
      job.abort('timeout');
    }, config.jobTimeoutMs);
    timeout.unref();

    try {
      await runJob(job);
    } catch (error) {
      if (job.isTerminal) {
        // The job already finished (or was cancelled) and broadcast its state.
      } else if (job.currentAbortReason === 'cancelled') {
        job.cancel();
      } else if (job.currentAbortReason === 'timeout') {
        job.fail({
          code: 'TIMEOUT',
          message: 'El proceso superó el tiempo máximo.',
          hint: 'Prueba con una APK más pequeña o aumenta JOB_TIMEOUT_MIN.',
        });
      } else if (job.currentAbortReason === 'shutdown') {
        job.cancel();
      } else {
        const payload = toJobError(error);
        job.log(
          'error',
          payload.hint ? `${payload.message} ${payload.hint}` : payload.message,
        );
        job.fail(payload);
      }
    } finally {
      clearTimeout(timeout);
      this.active.delete(job);
      this.pump();
    }
  }

  private async cleanupExpired(): Promise<void> {
    const now = Date.now();

    for (const [id, job] of this.jobs) {
      if (!job.isTerminal) continue;
      if (!job.expiresAt || job.expiresAt.getTime() >= now) continue;

      this.jobs.delete(id);
      await fs.rm(job.jobDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async cleanupOrphaned(): Promise<void> {
    const entries = await fs
      .readdir(config.jobsDir, { withFileTypes: true })
      .catch(() => []);

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
          fs
            .rm(path.join(config.jobsDir, entry.name), {
              recursive: true,
              force: true,
            })
            .catch(() => undefined),
        ),
    );
  }
}
