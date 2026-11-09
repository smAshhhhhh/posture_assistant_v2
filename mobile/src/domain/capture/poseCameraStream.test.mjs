import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const { initialPoseCameraStream, receivePoseCameraState, expirePoseCameraStream } =
  await loadTypeScript('src/domain/capture/poseCameraStream.ts');
const { parsePoseCameraState } = await loadTypeScript('src/domain/capture/poseCamera.ts');

const ready = parsePoseCameraState({
  status: 'ready',
  code: 'none',
  hasRequiredLandmarks: true,
  landmarkCount: 33,
  inferenceMs: 20,
  frameTimestampMs: 0,
});

test('帧时间与接收时间可从零开始，超过窗口撤销清晰并提示摘要停更', () => {
  const stream = receivePoseCameraState(initialPoseCameraStream, ready, 0);
  assert.equal(stream.latestFrameTimestampMs, 0);
  assert.equal(stream.lastProgressAtMs, 0);
  assert.equal(expirePoseCameraStream(stream, 1_500), stream);
  const stale = expirePoseCameraStream(stream, 1_501);
  assert.equal(stale.camera.code, 'summary_stale');
  assert.equal(stale.camera.hasRequiredLandmarks, false);
  assert.equal(stale.camera.frameTimestampMs, 0);
  assert.equal(expirePoseCameraStream(stale, 2_000), stale);
});

test('重复和倒退帧不延长清晰时间，也不能恢复过期提示', () => {
  let stream = receivePoseCameraState(
    initialPoseCameraStream,
    { ...ready, frameTimestampMs: 100 },
    100,
  );
  for (const timestamp of [100, 99, 0, 100]) {
    stream = receivePoseCameraState(stream, { ...ready, frameTimestampMs: timestamp }, 1_500);
    assert.equal(stream.lastProgressAtMs, 100);
  }
  const stale = expirePoseCameraStream(stream, 1_601);
  assert.equal(receivePoseCameraState(stale, stream.camera, 1_700), stale);
  const recovered = receivePoseCameraState(stale, { ...ready, frameTimestampMs: 101 }, 1_800);
  assert.equal(recovered.camera.code, 'none');
  assert.equal(recovered.camera.hasRequiredLandmarks, true);
  assert.equal(recovered.lastProgressAtMs, 1_800);
});

test('未检测到人体也是新帧；缺失时间戳不能保留清晰结论', () => {
  let stream = receivePoseCameraState(initialPoseCameraStream, ready, 0);
  const missing = parsePoseCameraState({
    ...ready,
    frameTimestampMs: 1,
    landmarkCount: 0,
    hasRequiredLandmarks: false,
  });
  stream = receivePoseCameraState(stream, missing, 1_400);
  assert.equal(expirePoseCameraStream(stream, 1_600).camera.code, 'none');
  assert.equal(stream.camera.landmarkCount, 0);
  const malformed = parsePoseCameraState({ ...ready, frameTimestampMs: null });
  stream = receivePoseCameraState(stream, malformed, 1_700);
  assert.equal(stream.camera.hasRequiredLandmarks, false);
  assert.equal(stream.lastProgressAtMs, 1_400);
});

test('错误与生命周期事件立即撤销清晰，不能被过期计时覆盖', () => {
  const stream = receivePoseCameraState(initialPoseCameraStream, ready, 0);
  for (const status of ['error', 'background', 'interrupted', 'starting', 'stopped']) {
    const state = parsePoseCameraState({ status, code: 'camera_unavailable' });
    const next = receivePoseCameraState(stream, state, 100);
    assert.equal(next.camera.status, status);
    assert.equal(next.camera.hasRequiredLandmarks, false);
    assert.equal(expirePoseCameraStream(next, 5_000), next);
  }
});

test('重新开启预览清空旧时间基线，允许新相机从较小时间戳开始', () => {
  const previous = receivePoseCameraState(
    initialPoseCameraStream,
    { ...ready, frameTimestampMs: 9_000 },
    1_000,
  );
  const next = receivePoseCameraState(initialPoseCameraStream, ready, 2_000);
  assert.equal(next.latestFrameTimestampMs, 0);
  assert.equal(next.camera.hasRequiredLandmarks, true);
  assert.equal(previous.latestFrameTimestampMs, 9_000);
  assert.equal(initialPoseCameraStream.latestFrameTimestampMs, null);
});
