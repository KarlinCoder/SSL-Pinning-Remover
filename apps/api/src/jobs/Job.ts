import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ChildProcess } from 'node:child_process';
import type { Response } from 'express';
import { config } from '../config.js';
import type {
  JobArtifact,
  JobErrorPayload,
  JobLog,
  JobPhase,
  JobSnapshot,
  JobStatus,
  LogLevel,
} from '../types.js';
import { cleanLogMessage, killProcessTree, truncate } from '../lib/utils.js';

type AbortReason = 'cancelled' | 'timeout' | 'shutdown';

export class Job {
  readonly id = randomUUID();
  readonly inputUrl: string;
  readonly sourceHost: string;
  readonly createdAt = new Date();
  readonly jobDir: string;
  readonly logs: JobLog[] = [];

  sourceFilename?: string;
  startedAt?: Date;
  finishedAt?: Date;
  expiresAt?: Date;
  status: JobStatus = 'queued';
  phase: JobPhase = 'queued';
  progress = 0;
  queuePosition?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  artifact?: JobArtifact;
  error?: JobErrorPayload;
  inputPath?: string;
  outputPath?: string;

  private logSequence = 0;
  private readonly heartbeats = new Map<Response, NodeJS.Timeout>();
  private readonly abortController = new AbortController();
  private abortReason?: AbortReason;
  private child?: ChildProcess;

  constructor(inputUrl: string) {
    this.inputUrl = inputUrl;
    let parsedHostname: string;
    try {
      parsedHostname = new URL(inputUrl).hostname;
    } catch {
      parsedHostname = 'upload';
    }
    this.sourceHost = parsedHostname;
    this.jobDir = path.join(config.jobsDir, this.id);
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  get currentAbortReason(): AbortReason | undefined {
    return this.abortReason;
  }

  get isTerminal(): boolean {
    return ['completed', 'failed', 'cancelled', 'expired'].includes(this.status);
  }

  get isRunning(): boolean {
    return ['downloading', 'inspecting', 'patching', 'packaging'].includes(this.status);
  }

  setStatus(status: JobStatus, phase: JobPhase = this.phase, progress = this.progress): void {
    if (this.isTerminal) return;
    this.status = status;
    this.phase = phase;
    this.progress = Math.max(0, Math.min(100, progress));
    this.broadcast('status', this.statusPayload());
  }

  setPhase(phase: JobPhase, progress: number): void {
    if (this.isTerminal) return;
    this.status = 'patching';
    this.phase = phase;
    this.progress = Math.max(this.progress, Math.min(99, progress));
    this.broadcast('status', this.statusPayload());
  }

  log(level: LogLevel, message: string): void {
    const cleaned = cleanLogMessage(message);
    if (!cleaned) return;

    const entry: JobLog = {
      seq: (this.logSequence += 1),
      ts: new Date().toISOString(),
      level,
      message: cleaned,
    };

    this.logs.push(entry);
    if (this.logs.length > config.maxLogLines * 2) {
      this.logs.splice(0, this.logs.length - config.maxLogLines);
    }

    this.broadcast('log', entry);
  }

  attachChild(child: ChildProcess): void {
    this.child = child;
    if (this.signal.aborted) killProcessTree(child);
  }

  clearChild(): void {
    this.child = undefined;
  }

  abort(reason: AbortReason): void {
    if (this.abortReason) return;
    this.abortReason = reason;
    this.abortController.abort();
    if (this.child) killProcessTree(this.child);
  }

  complete(artifact: JobArtifact): void {
    this.status = 'completed';
    this.phase = 'done';
    this.progress = 100;
    this.artifact = artifact;
    this.finishedAt = new Date();
    this.expiresAt = new Date(artifact.expiresAt);
    this.broadcast('done', this.snapshot(true));
    this.scheduleClose();
  }

  fail(error: JobErrorPayload): void {
    this.status = 'failed';
    this.error = error;
    this.finishedAt = new Date();
    this.expiresAt = new Date(Date.now() + config.jobTtlMs);
    this.broadcast('done', this.snapshot(true));
    this.scheduleClose();
  }

  cancel(): void {
    this.status = 'cancelled';
    this.error = {
      code: 'CANCELLED',
      message: 'El trabajo fue cancelado.',
    };
    this.finishedAt = new Date();
    this.expiresAt = new Date(Date.now() + config.jobTtlMs);
    this.broadcast('done', this.snapshot(true));
    this.scheduleClose();
  }

  expire(): void {
    this.status = 'expired';
    this.artifact = undefined;
    this.finishedAt = new Date();
    this.expiresAt = new Date();
    this.broadcast('done', this.snapshot(true));
    this.scheduleClose();
  }

  snapshot(includeLogs = true): JobSnapshot {
    return {
      id: this.id,
      status: this.status,
      phase: this.phase,
      progress: this.progress,
      createdAt: this.createdAt.toISOString(),
      startedAt: this.startedAt?.toISOString(),
      finishedAt: this.finishedAt?.toISOString(),
      expiresAt: this.expiresAt?.toISOString(),
      sourceHost: this.sourceHost,
      sourceFilename: this.sourceFilename,
      queuePosition: this.queuePosition,
      downloadedBytes: this.downloadedBytes,
      totalBytes: this.totalBytes,
      artifact: this.artifact,
      error: this.error,
      logs: includeLogs ? this.logs.slice(-config.maxLogLines) : undefined,
    };
  }

  attachSse(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');

    const heartbeat = setInterval(() => {
      if (res.writableEnded || res.destroyed) return;
      try {
        res.write(': ping\n\n');
      } catch {
        this.removeClient(res);
      }
    }, 15_000);
    heartbeat.unref();

    this.heartbeats.set(res, heartbeat);
    this.send(res, 'snapshot', this.snapshot(true));

    // Un cliente que llega cuando el trabajo ya terminó recibe el snapshot
    // final y la conexión se cierra poco después.
    if (this.isTerminal) this.scheduleClose();

    res.on('close', () => this.removeClient(res));
  }

  closeSse(): void {
    for (const [res, heartbeat] of this.heartbeats) {
      clearInterval(heartbeat);
      try {
        res.end();
      } catch {
        // The connection may already be closed.
      }
    }
    this.heartbeats.clear();
  }

  recentLogText(lines = 80): string {
    const text = this.logs
      .slice(-lines)
      .map((entry) => `[${entry.level}] ${entry.message}`)
      .join('\n');
    return truncate(text, 6000);
  }

  private statusPayload(): Record<string, unknown> {
    return {
      id: this.id,
      status: this.status,
      phase: this.phase,
      progress: this.progress,
      queuePosition: this.queuePosition,
      downloadedBytes: this.downloadedBytes,
      totalBytes: this.totalBytes,
      startedAt: this.startedAt?.toISOString(),
      finishedAt: this.finishedAt?.toISOString(),
      expiresAt: this.expiresAt?.toISOString(),
    };
  }

  private broadcast(event: string, data: unknown): void {
    for (const res of this.heartbeats.keys()) {
      this.send(res, event, data);
    }
  }

  private send(res: Response, event: string, data: unknown): void {
    if (res.writableEnded || res.destroyed) {
      this.removeClient(res);
      return;
    }

    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.removeClient(res);
    }
  }

  private removeClient(res: Response): void {
    const heartbeat = this.heartbeats.get(res);
    if (heartbeat) clearInterval(heartbeat);
    this.heartbeats.delete(res);
  }

  private scheduleClose(): void {
    const timeout = setTimeout(() => this.closeSse(), 1500);
    timeout.unref();
  }
}
