import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const { parsePoseCameraState } = await loadTypeScript('src/domain/capture/poseCamera.ts');
const { getRequiredLandmarks } = await loadTypeScript('src/domain/capture/requiredLandmarks.ts');
const { rehabTasks } = await loadTypeScript('src/domain/tasks/taskCatalog.ts');

const ready = {
  status: 'ready',
  code: 'none',
  hasRequiredLandmarks: true,
  landmarkCount: 33,
  inferenceMs: 30,
  frameTimestampMs: 1_000,
};

test('原生摘要必须有明确状态，未知或破损数据不能进入流程', () => {
  for (const value of [null, undefined, [], 1, 'ready', {}, { status: 'other', code: 'none' }]) {
    assert.equal(parsePoseCameraState(value), null);
  }
  assert.equal(parsePoseCameraState({ ...ready, code: null }), null);
  assert.equal(parsePoseCameraState({ ...ready, landmarkCount: 33.5 }), null);
  assert.equal(parsePoseCameraState({ ...ready, landmarkCount: 34 }), null);
  assert.deepEqual(parsePoseCameraState(ready), ready);
});

test('无点、非法数值或丢失时间戳时，不能声称关键点清晰', () => {
  const failures = [
    { landmarkCount: 0 },
    { landmarkCount: Number.NaN },
    { landmarkCount: -1 },
    { frameTimestampMs: null },
    { frameTimestampMs: Number.POSITIVE_INFINITY },
    { status: 'stopped' },
    { status: 'error' },
    { status: 'background' },
    { code: 'camera_unavailable' },
  ];
  for (const failure of failures) {
    const result = parsePoseCameraState({ ...ready, ...failure });
    assert.equal(result?.hasRequiredLandmarks, false);
  }
});

test('缺失指标保留 null，真实零值保留 0', () => {
  const missing = parsePoseCameraState({ status: 'starting', code: 'none' });
  assert.equal(missing.inferenceMs, null);
  assert.equal(missing.landmarkCount, null);
  assert.equal(missing.frameTimestampMs, null);
  const zero = parsePoseCameraState({ ...ready, inferenceMs: 0, frameTimestampMs: 0 });
  assert.equal(zero.inferenceMs, 0);
  assert.equal(zero.frameTimestampMs, 0);
});

test('肘关节与膝关节按患者自身左右侧选择关键点', () => {
  assert.deepEqual(getRequiredLandmarks('elbow_flexion_extension', 'left'), [11, 13, 15]);
  assert.deepEqual(getRequiredLandmarks('elbow_flexion_extension', 'right'), [12, 14, 16]);
  assert.deepEqual(getRequiredLandmarks('seated_knee_extension', 'left'), [23, 25, 27]);
  assert.deepEqual(getRequiredLandmarks('seated_knee_extension', 'right'), [24, 26, 28]);
});

test('七种任务均有合法且不重复的必要关节，站立任务覆盖双侧下肢', () => {
  for (const task of rehabTasks) {
    for (const side of ['left', 'right']) {
      const indices = getRequiredLandmarks(task.id, side);
      assert.ok(indices.length >= 3);
      assert.equal(new Set(indices).size, indices.length);
      assert.ok(indices.every((index) => Number.isInteger(index) && index >= 0 && index <= 32));
      if (task.requiresSafetyConfirmation) {
        for (const index of [23, 24, 25, 26, 27, 28]) assert.ok(indices.includes(index));
      }
    }
  }
});
