import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const { createCaptureSession, transitionCaptureSession, getCaptureDurationMs } =
  await loadTypeScript('src/domain/capture/captureSession.ts');
const { getCaptureBlockers } = await loadTypeScript('src/domain/capture/captureReadiness.ts');

const context = {
  patientId: 'test-patient',
  taskId: 'elbow_flexion_extension',
  affectedSide: 'right',
  requiresSafetyConfirmation: false,
};
const readiness = {
  hasPatient: true,
  requiresSafetyConfirmation: false,
  hasSafetyConfirmation: false,
  permission: 'granted',
  isCameraReady: true,
  isModelReady: true,
  hasRequiredLandmarks: true,
  isAppActive: true,
};
const start = (session = createCaptureSession(context)) =>
  transitionCaptureSession(session, { type: 'start', atMs: 1_000, readiness });

test('缺少任一开始条件时不能启动', () => {
  const failures = [
    { hasPatient: false },
    { requiresSafetyConfirmation: true, hasSafetyConfirmation: false },
    { permission: 'unknown' },
    { permission: 'denied' },
    { permission: 'blocked' },
    { permission: 'unavailable' },
    { isCameraReady: false },
    { isModelReady: false },
    { hasRequiredLandmarks: false },
    { isAppActive: false },
  ];

  for (const failure of failures) {
    const conditions = { ...readiness, ...failure };
    const session = createCaptureSession({
      ...context,
      requiresSafetyConfirmation: conditions.requiresSafetyConfirmation,
    });
    assert.ok(getCaptureBlockers(conditions).length > 0);
    assert.equal(
      transitionCaptureSession(session, { type: 'start', atMs: 1_000, readiness: conditions }),
      session,
    );
  }
});

test('不能通过传入条件绕过患者和站立任务的安全要求', () => {
  for (const overrides of [{ patientId: '' }, { requiresSafetyConfirmation: true }]) {
    const session = createCaptureSession({ ...context, ...overrides });
    assert.equal(start(session), session);
  }
});

test('站立任务确认安全后可以开始', () => {
  const session = createCaptureSession({ ...context, requiresSafetyConfirmation: true });
  const result = transitionCaptureSession(session, {
    type: 'start',
    atMs: 1_000,
    readiness: { ...readiness, hasSafetyConfirmation: true },
  });
  assert.equal(result.phase, 'capturing');
});

test('有效时长排除暂停时间，普通结束不推断患者完成状态和质量', () => {
  const active = start();
  assert.equal(getCaptureDurationMs(active, 3_000), 2_000);
  const paused = transitionCaptureSession(active, { type: 'pause', atMs: 4_000, reason: 'manual' });
  assert.equal(getCaptureDurationMs(paused, 20_000), 3_000);
  const resumed = transitionCaptureSession(paused, { type: 'resume', atMs: 10_000, readiness });
  const ended = transitionCaptureSession(resumed, { type: 'finish', atMs: 12_000 });
  assert.equal(ended.elapsedActiveMs, 5_000);
  assert.equal(ended.activeSinceMs, null);
  assert.equal(ended.taskStatus, null);
  assert.equal(ended.captureQuality, null);
});

test('后台和权限中断后，必须重新满足条件才能显式恢复', () => {
  for (const reason of ['background', 'permission_lost', 'device_error']) {
    const paused = transitionCaptureSession(start(), { type: 'pause', atMs: 3_000, reason });
    assert.equal(paused.phase, 'paused');
    assert.equal(paused.activeSinceMs, null);
    assert.equal(
      transitionCaptureSession(paused, {
        type: 'resume',
        atMs: 5_000,
        readiness: { ...readiness, permission: 'denied' },
      }),
      paused,
    );
    assert.equal(
      transitionCaptureSession(paused, { type: 'resume', atMs: 6_000, readiness }).phase,
      'capturing',
    );
  }
});

test('安全停止立即结束计时，不能被结束、恢复或放弃覆盖', () => {
  for (const shouldPause of [false, true]) {
    const active = start();
    const source = shouldPause
      ? transitionCaptureSession(active, { type: 'pause', atMs: 2_000, reason: 'manual' })
      : active;
    const stopped = transitionCaptureSession(source, { type: 'stop_safety', atMs: 3_000 });
    assert.equal(stopped.phase, 'stopped_safety');
    assert.equal(stopped.taskStatus, 'stopped_safety');
    assert.equal(stopped.captureQuality, null);
    assert.equal(stopped.activeSinceMs, null);

    for (const type of ['finish', 'discard', 'start', 'resume', 'stop_safety']) {
      assert.equal(transitionCaptureSession(stopped, { type, atMs: 4_000, readiness }), stopped);
    }
    const annotated = transitionCaptureSession(stopped, {
      type: 'record_safety_reason',
      atMs: 5_000,
      reason: 'pain',
    });
    assert.equal(annotated.safetyStopReason, 'pain');
    assert.equal(annotated.taskStatus, 'stopped_safety');
    assert.equal(annotated.elapsedActiveMs, shouldPause ? 1_000 : 2_000);
  }
});

test('重复点击、不合法顺序和乱序时间戳不改变会话', () => {
  const preparing = createCaptureSession(context);
  assert.equal(transitionCaptureSession(preparing, { type: 'finish', atMs: 500 }), preparing);
  const active = start();
  for (const atMs of [500, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(transitionCaptureSession(active, { type: 'finish', atMs }), active);
  }
  assert.equal(start(active), active);
  const ended = transitionCaptureSession(active, { type: 'finish', atMs: 2_000 });
  assert.equal(transitionCaptureSession(ended, { type: 'finish', atMs: 5_000 }), ended);
  assert.equal(transitionCaptureSession(ended, { type: 'resume', atMs: 5_000, readiness }), ended);
});

test('放弃前停止计时且保持终态', () => {
  const discarded = transitionCaptureSession(start(), { type: 'discard', atMs: 2_500 });
  assert.equal(discarded.phase, 'discarded');
  assert.equal(discarded.elapsedActiveMs, 1_500);
  assert.equal(discarded.activeSinceMs, null);
  assert.equal(start(discarded), discarded);
});
