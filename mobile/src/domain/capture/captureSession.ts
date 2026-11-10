import type { CaptureQuality, TaskStatus } from '../observations/types';
import type { AffectedSide } from '../patients/types';
import type { RehabTaskId } from '../tasks/taskCatalog';
import { getTaskProtocol } from '../tasks/taskProtocol';
import type { TaskProtocol } from '../tasks/taskProtocol';

import { getCaptureBlockers } from './captureReadiness';
import type { CaptureReadiness } from './captureReadiness';

export type CapturePhase = 'preparing' | 'capturing' | 'paused' | 'finished' | 'discarded';

export type CapturePauseReason = 'manual' | 'background' | 'permission_lost' | 'device_error';
export interface CaptureContext {
  readonly patientId: string;
  readonly taskId: RehabTaskId;
  readonly affectedSide: AffectedSide;
}

export interface CaptureSession {
  readonly taskProtocol: TaskProtocol;
  readonly context: CaptureContext;
  readonly phase: CapturePhase;
  readonly elapsedActiveMs: number;
  readonly activeSinceMs: number | null;
  readonly lastTransitionAtMs: number;
  readonly pauseReason: CapturePauseReason | null;
  readonly taskStatus: TaskStatus | null;
  readonly captureQuality: CaptureQuality | null;
}

export type CaptureEvent =
  | {
      readonly type: 'start' | 'resume';
      readonly atMs: number;
      readonly readiness: CaptureReadiness;
    }
  | { readonly type: 'pause'; readonly atMs: number; readonly reason: CapturePauseReason }
  | { readonly type: 'finish' | 'discard'; readonly atMs: number };

export function createCaptureSession(context: CaptureContext): CaptureSession {
  return {
    taskProtocol: getTaskProtocol(context.taskId, context.affectedSide),
    context,
    phase: 'preparing',
    elapsedActiveMs: 0,
    activeSinceMs: null,
    lastTransitionAtMs: 0,
    pauseReason: null,
    taskStatus: null,
    captureQuality: null,
  };
}

// atMs 使用同一单调时钟；暂停时间不计入有效采集时长。
export function getCaptureDurationMs(session: CaptureSession, atMs: number): number {
  if (session.activeSinceMs === null || !Number.isFinite(atMs)) {
    return session.elapsedActiveMs;
  }

  return session.elapsedActiveMs + Math.max(0, atMs - session.activeSinceMs);
}

export function transitionCaptureSession(
  session: CaptureSession,
  event: CaptureEvent,
): CaptureSession {
  if (!Number.isFinite(event.atMs) || event.atMs < session.lastTransitionAtMs) return session;

  if (session.phase === 'finished' || session.phase === 'discarded') return session;

  if (event.type === 'start' || event.type === 'resume') {
    const expectedPhase = event.type === 'start' ? 'preparing' : 'paused';
    const readiness = {
      ...event.readiness,
      hasPatient: session.context.patientId.trim().length > 0 && event.readiness.hasPatient,
    };

    if (session.phase !== expectedPhase || getCaptureBlockers(readiness).length > 0) {
      return session;
    }

    return {
      ...session,
      phase: 'capturing',
      activeSinceMs: event.atMs,
      lastTransitionAtMs: event.atMs,
      pauseReason: null,
    };
  }

  if (event.type === 'pause' && session.phase === 'capturing') {
    return {
      ...session,
      phase: 'paused',
      elapsedActiveMs: getCaptureDurationMs(session, event.atMs),
      activeSinceMs: null,
      lastTransitionAtMs: event.atMs,
      pauseReason: event.reason,
    };
  }

  const hasStarted = session.phase === 'capturing' || session.phase === 'paused';
  if (event.type === 'finish' && hasStarted) {
    return {
      ...session,
      phase: 'finished',
      elapsedActiveMs: getCaptureDurationMs(session, event.atMs),
      activeSinceMs: null,
      lastTransitionAtMs: event.atMs,
      pauseReason: null,
      taskStatus: null,
    };
  }

  if (event.type === 'discard') {
    return {
      ...session,
      phase: 'discarded',
      elapsedActiveMs: getCaptureDurationMs(session, event.atMs),
      activeSinceMs: null,
      lastTransitionAtMs: event.atMs,
      pauseReason: null,
    };
  }

  return session;
}
