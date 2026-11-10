import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const { getCaptureFeedback } = await loadTypeScript('src/domain/capture/captureFeedback.ts');
const { createCaptureSession, transitionCaptureSession } = await loadTypeScript(
  'src/domain/capture/captureSession.ts',
);
const { parsePoseCameraState, initialPoseCameraState } = await loadTypeScript(
  'src/domain/capture/poseCamera.ts',
);
const { rehabTasks } = await loadTypeScript('src/domain/tasks/taskCatalog.ts');
const { getTaskInstructions } = await loadTypeScript('src/domain/tasks/taskInstructions.ts');

const readiness = { hasPatient: true, hasSafetyConfirmation: true, isAppActive: true };
const ready = parsePoseCameraState({
  status: 'ready',
  code: 'none',
  hasRequiredLandmarks: true,
  landmarkCount: 33,
  inferenceMs: 0,
  frameTimestampMs: 0,
});

function session(taskId = 'elbow_flexion_extension', affectedSide = 'left') {
  return createCaptureSession({ patientId: 'patient-1', taskId, affectedSide });
}

test('七任务按患者自身左右侧给出机位建议，不能把不清晰归因于特定关节', () => {
  for (const task of rehabTasks) {
    for (const side of ['left', 'right']) {
      const current = session(task.id, side);
      const feedback = getCaptureFeedback(current, { ...ready, hasRequiredLandmarks: false }, true);
      assert.equal(feedback.code, 'landmarks_unclear');
      assert.ok(feedback.message.includes(getTaskInstructions(task.id, side).framing));
      assert.doesNotMatch(feedback.message, /已遮挡|已经出镜|动作错误/);
      assert.equal(current.taskStatus, null);
      assert.equal(current.captureQuality, null);
    }
  }
});

test('区分无人体、关节不清、摘要缺失及停更，零时间戳仍是可用帧', () => {
  const current = session();
  const cases = [
    [ready, 'ready'],
    [{ ...ready, hasRequiredLandmarks: false, landmarkCount: 0 }, 'body_missing'],
    [{ ...ready, hasRequiredLandmarks: false }, 'landmarks_unclear'],
    [{ ...ready, frameTimestampMs: null, hasRequiredLandmarks: false }, 'summary_unavailable'],
    [{ ...ready, landmarkCount: null, hasRequiredLandmarks: false }, 'summary_unavailable'],
    [{ ...ready, code: 'summary_stale', hasRequiredLandmarks: false }, 'summary_stale'],
  ];
  for (const [camera, expected] of cases) {
    assert.equal(getCaptureFeedback(current, camera, true).code, expected);
  }
});

test('四种暂停原因均提示直接继续，设备恢复期间仍保持暂停', () => {
  const capturing = transitionCaptureSession(session(), { type: 'start', atMs: 0, readiness });
  const reasons = {
    manual: '手动暂停',
    background: '离开前台',
    permission_lost: '重新授权',
    device_error: '发生中断',
  };
  for (const [reason, text] of Object.entries(reasons)) {
    const paused = transitionCaptureSession(capturing, { type: 'pause', atMs: 1_000, reason });
    const previewOff = getCaptureFeedback(paused, initialPoseCameraState, false);
    assert.equal(previewOff.code, 'paused');
    assert.ok(previewOff.message.includes(text));
    assert.match(previewOff.message, /点击“继续采集”即可恢复/);
    assert.doesNotMatch(previewOff.message, /重新检查机位|确认后继续/);
    const previewOn = getCaptureFeedback(paused, ready, true);
    assert.equal(previewOn.code, 'paused');
    assert.match(previewOn.message, /恢复后将自动继续记录/);
    const resumed = transitionCaptureSession(paused, { type: 'resume', atMs: 2_000, readiness });
    assert.equal(getCaptureFeedback(resumed, ready, true).code, 'ready');
    assert.equal(resumed.pauseReason, null);
    assert.equal(resumed.elapsedActiveMs, 1_000);
  }
});

test('设备错误说明在准备与暂停时均可见，结束后不再提供动作指令', () => {
  const error = parsePoseCameraState({ status: 'error', code: 'video_recording_failed' });
  const current = session();
  assert.match(getCaptureFeedback(current, error, false).message, /存储空间/);
  const capturing = transitionCaptureSession(current, { type: 'start', atMs: 0, readiness });
  const paused = transitionCaptureSession(capturing, {
    type: 'pause',
    atMs: 1_000,
    reason: 'device_error',
  });
  assert.match(getCaptureFeedback(paused, error, false).message, /存储空间/);
  const stopped = transitionCaptureSession(paused, { type: 'finish', atMs: 2_000 });
  for (const camera of [ready, error, initialPoseCameraState]) {
    const feedback = getCaptureFeedback(stopped, camera, true);
    assert.equal(feedback.code, 'finished');
    assert.match(feedback.message, /已经停止/);
    assert.doesNotMatch(feedback.message, /继续采集/);
  }
});

test('暂停后自动恢复相机不要求人体或关节检查，不覆盖暂停状态', () => {
  const capturing = transitionCaptureSession(session(), { type: 'start', atMs: 0, readiness });
  const paused = transitionCaptureSession(capturing, {
    type: 'pause',
    atMs: 1_000,
    reason: 'manual',
  });
  const cases = [
    [{ ...ready, code: 'summary_stale', hasRequiredLandmarks: false }, '识别摘要暂未更新'],
    [{ ...ready, landmarkCount: 0, hasRequiredLandmarks: false }, '暂未检测到人体'],
    [{ ...ready, hasRequiredLandmarks: false }, '关键关节暂不清晰'],
  ];
  for (const [camera, text] of cases) {
    const feedback = getCaptureFeedback(paused, camera, true);
    assert.equal(feedback.code, 'paused');
    assert.ok(!feedback.message.includes(text));
    assert.match(feedback.message, /恢复后将自动继续记录/);
    assert.doesNotMatch(feedback.message, /请暂停后|检查机位|确认后/);
    assert.equal(paused.phase, 'paused');
  }
});

test('关闭或等待预览不显示清晰，普通结束后也不再给出动作指令', () => {
  const current = session();
  assert.equal(getCaptureFeedback(current, ready, false).code, 'preview_off');
  const starting = parsePoseCameraState({ status: 'starting', code: 'none' });
  assert.equal(getCaptureFeedback(current, starting, true).code, 'waiting');
  const capturing = transitionCaptureSession(current, { type: 'start', atMs: 0, readiness });
  const finished = transitionCaptureSession(capturing, { type: 'finish', atMs: 2_000 });
  assert.equal(getCaptureFeedback(finished, ready, true).code, 'finished');
});

test('七任务的识别提示均不阻止人工确认后开始，也不推断任务完成', () => {
  for (const task of rehabTasks) {
    const current = session(task.id);
    for (const camera of [
      initialPoseCameraState,
      ready,
      { ...ready, hasRequiredLandmarks: false },
    ]) {
      getCaptureFeedback(current, camera, true);
      const capturing = transitionCaptureSession(current, { type: 'start', atMs: 0, readiness });
      assert.equal(capturing.phase, 'capturing');
      assert.equal(capturing.taskStatus, null);
      assert.equal(capturing.captureQuality, null);
    }
  }
});
