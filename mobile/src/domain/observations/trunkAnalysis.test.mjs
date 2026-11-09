import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const { analyzeJoint, getJointAngle } = await loadTypeScript(
  'src/domain/observations/angleAnalysis.ts',
);
const { getAngleObservationProtocol } = await loadTypeScript(
  'src/domain/observations/angleProtocols.ts',
);
const { createObservationReport } = await loadTypeScript(
  'src/domain/observations/observationReport.ts',
);
const { parseObservationReport } = await loadTypeScript(
  'src/domain/observations/observationParser.ts',
);
const { getObservationChanges } = await loadTypeScript(
  'src/domain/observations/observationHistory.ts',
);
const taskId = 'seated_trunk_lean';

function frame(timestampMs, degrees, side = 'left', width = 640, height = 480) {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.6,
    visibility: 1,
    presence: 1,
  }));
  const radians = (degrees * Math.PI) / 180;
  const shoulder = side === 'left' ? 11 : 12;
  const knee = side === 'left' ? 25 : 26;
  landmarks[shoulder] = {
    ...landmarks[shoulder],
    x: 0.5 + (Math.sin(radians) * 100) / width,
    y: 0.6 - (Math.cos(radians) * 100) / height,
  };
  landmarks[knee] = { ...landmarks[knee], x: 0.8, y: 0.6 };
  return { timestampMs, imageWidth: width, imageHeight: height, isInPreview: true, landmarks };
}

function recording(angles, side = 'left') {
  return {
    schemaVersion: 1,
    id: '12345678-1234-4234-8234-123456789abc',
    observedAt: '2026-11-09T10:00:00.000Z',
    modelVersion: 'pose_landmarker_lite/float16/1',
    durationMs: angles.length * 100,
    isTruncated: false,
    frames: angles.map((angle, index) => frame(index * 100, angle, side)),
  };
}

function motion(start = 0, peak = 40, end = 0) {
  return Array.from({ length: 60 }, (_, index) => (index < 15 ? start : index < 35 ? peak : end));
}

test('躯干倾角以画面竖直方向为参照，左右侧和横竖画幅不改变角度', () => {
  for (const side of ['left', 'right']) {
    for (const [width, height] of [
      [640, 480],
      [480, 640],
      [1080, 1920],
    ]) {
      for (const degrees of [-70, -25, 0, 25, 70, 90]) {
        const sample = frame(0, degrees, side, width, height);
        const angle = getJointAngle(sample, side, taskId);
        assert.ok(Math.abs(angle - Math.abs(degrees)) < 1e-6);
      }
    }
  }
});

test('膝位置变化不改变躯干倾角，遮挡、出镜或躯干骨段退化返回缺失', () => {
  for (const side of ['left', 'right']) {
    const shoulder = side === 'left' ? 11 : 12;
    const hip = side === 'left' ? 23 : 24;
    const knee = side === 'left' ? 25 : 26;
    const sample = frame(0, 30, side);
    sample.landmarks[knee] = { ...sample.landmarks[knee], x: 0.1, y: 0.9 };
    assert.ok(Math.abs(getJointAngle(sample, side, taskId) - 30) < 1e-6);
    for (const index of [shoulder, hip, knee]) {
      const hidden = structuredClone(sample);
      hidden.landmarks[index].visibility = 0.49;
      assert.equal(getJointAngle(hidden, side, taskId), null);
      hidden.landmarks[index].visibility = 1;
      hidden.landmarks[index].presence = 0.49;
      assert.equal(getJointAngle(hidden, side, taskId), null);
      hidden.landmarks[index].presence = 1;
      hidden.landmarks[index].x = -0.1;
      assert.equal(getJointAngle(hidden, side, taskId), null);
    }
    assert.equal(getJointAngle({ ...sample, isInPreview: false }, side, taskId), null);
    sample.landmarks[shoulder] = sample.landmarks[hip];
    assert.equal(getJointAngle(sample, side, taskId), null);
  }
});

test('躯干只计完整坐直倾斜回正周期，未回正、未到目标及中途开始不计数', () => {
  for (const side of ['left', 'right']) {
    assert.equal(analyzeJoint(recording(motion(), side), side, taskId).repetitions, 1);
    for (const angles of [motion(0, 40, 20), motion(0, 20, 0), motion(40, 40, 0)]) {
      assert.equal(analyzeJoint(recording(angles, side), side, taskId).repetitions, 0);
    }
    const twice = recording([...motion(), ...motion()], side);
    assert.equal(analyzeJoint(twice, side, taskId).repetitions, 2);
    // 倾角取绝对值，后仰也会产生周期，不能据此判定前倾完成。
    assert.equal(analyzeJoint(recording(motion(0, -40, 0), side), side, taskId).repetitions, 1);
  }
});

test('暂停和长漏检断开躯干周期，无效采集隐藏指标，静止保留真实零值', () => {
  const input = recording(motion());
  for (const interrupted of [
    {
      ...input,
      frames: input.frames.map((sample, index) =>
        index === 33 ? { ...sample, landmarks: [] } : sample,
      ),
    },
    { ...input, frames: input.frames.filter((_, index) => index < 32 || index > 36) },
  ]) {
    assert.equal(analyzeJoint(interrupted, 'left', taskId).repetitions, 0);
  }
  const still = analyzeJoint(recording(Array(60).fill(0)), 'left', taskId);
  assert.equal(still.captureQuality, 'valid');
  assert.equal(still.repetitions, 0);
  assert.equal(still.rangeOfMotion, 0);
  const invalid = analyzeJoint({ ...input, isTruncated: true }, 'left', taskId);
  assert.equal(invalid.captureQuality, 'invalid_capture');
  for (const key of ['minAngle', 'maxAngle', 'rangeOfMotion', 'repetitions']) {
    assert.equal(invalid[key], null);
  }
  assert.ok(invalid.series.every((sample) => sample.angle === null));
});

test('躯干报告可回读和同协议对比，指标使用倾角名称且不自动决定任务状态', () => {
  const patient = { id: 'patient-1', patientCode: 'PA-01', revision: 1, affectedSide: 'left' };
  const session = {
    phase: 'finished',
    context: { taskId, patientId: patient.id, affectedSide: 'left' },
    safetyStopReason: null,
  };
  const first = createObservationReport(patient, session, recording(motion()), 'partial', false);
  assert.equal(first.taskStatus, 'partial');
  assert.equal(first.repetitions, 1);
  assert.equal(first.protocolVersion, 'trunk-seated-side-v1');
  assert.equal(first.analysisVersion, 'trunk-inclination-2d-v1');
  assert.deepEqual(parseObservationReport(first), first);
  const other = createObservationReport(
    patient,
    session,
    {
      ...recording(motion(0, 50, 0)),
      id: '12345678-1234-4234-8234-123456789def',
      observedAt: '2026-11-09T11:00:00.000Z',
    },
    'completed',
    false,
  );
  const changes = getObservationChanges(first, other);
  assert.deepEqual(changes.issues, []);
  assert.deepEqual(
    changes.metrics.slice(0, 3).map((metric) => metric.label),
    ['躯干倾角变化范围', '最小倾角', '最大倾角'],
  );
  assert.ok(changes.metrics[0].change > 9.9);
  const changedProtocol = { ...other, protocolVersion: 'trunk-seated-side-v2' };
  assert.throws(() => parseObservationReport(changedProtocol));
  assert.ok(getObservationChanges(first, changedProtocol).issues.length > 0);
  const protocol = getAngleObservationProtocol(taskId);
  assert.equal(protocol.measurement, 'image_vertical');
  assert.ok(protocol.interpretation.includes('不能区分前倾与后仰'));
});
