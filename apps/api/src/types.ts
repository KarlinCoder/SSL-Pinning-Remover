export type PackageKind = 'apk' | 'xapk' | 'apks';

export type JobStatus =
  | 'queued'
  | 'downloading'
  | 'inspecting'
  | 'patching'
  | 'packaging'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type JobPhase =
  | 'queued'
  | 'download'
  | 'inspect'
  | 'decode'
  | 'manifest'
  | 'network-config'
  | 'pinning'
  | 'build'
  | 'sign'
  | 'package'
  | 'done';

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

export interface JobLog {
  seq: number;
  ts: string;
  level: LogLevel;
  message: string;
}

export interface JobErrorPayload {
  code: string;
  message: string;
  hint?: string;
  detail?: string;
}

export interface JobArtifact {
  filename: string;
  size: number;
  sha256: string;
  kind: PackageKind;
  downloadUrl: string;
  expiresAt: string;
}

export interface JobSnapshot {
  id: string;
  status: JobStatus;
  phase: JobPhase;
  progress: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  expiresAt?: string;
  sourceHost: string;
  sourceFilename?: string;
  queuePosition?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  artifact?: JobArtifact;
  error?: JobErrorPayload;
  logs?: JobLog[];
}
