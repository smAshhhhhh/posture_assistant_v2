import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';
import { createObservationReport } from './recordingFixtures.mjs';

const { analyzeJoint, getJointAngle } = await loadTypeScript(
  'src/domain/observations/angleAnalysis.ts',
);
const { getAngleObservationProtocol } = await loadTypeScript(
  'src/domain/observations/angleProtocols.ts',
);
const { parseObservationReport } = await loadTypeScript(
  'src/domain/observations/observationParser.ts',
);

const taskIds = [
  'shoulder_flexion',
  'elbow_flexion_extension',
  'seated_knee_extension',
  'seated_trunk_lean',
];
const patient = { id: 'patient-1', patientCode: 'PA-01', affectedSide: 'left', revision: 1 };

function frame(taskId, timestampMs, degrees, side = 'left') {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
    presence: 1,
  }));
  const protocol = getAngleObservationProtocol(taskId);
  const offset = side === 'left' ? 0 : 1;
  const [first, center, last] = protocol.leftIndices.map((index) => index + offset);
  const direction = taskId === 'shoulder_flexion' ? 1 : -1;
  const radians = (degrees * Math.PI) / 180;
  landmarks[first] = { ...landmarks[first], y: 0.5 + direction * 0.2 };
  landmarks[center] = { ...landmarks[center], x: 0.5, y: 0.5 };
  landmarks[last] = {
    ...landmarks[last],
    x: 0.5 + ((side === 'left' ? 1 : -1) * Math.sin(radians) * 96) / 640,
    y: 0.5 + (direction * Math.cos(radians) * 96) / 480,
  };
  if (taskId === 'seated_trunk_lean') {
    landmarks[first] = {
      ...landmarks[first],
      x: 0.5 + ((side === 'left' ? 1 : -1) * Math.sin(radians) * 96) / 640,
      y: 0.5 - (Math.cos(radians) * 96) / 480,
    };
    landmarks[last] = { ...landmarks[last], x: 0.7, y: 0.5 };
  }
  return { timestampMs, imageWidth: 640, imageHeight: 480, isInPreview: true, landmarks };
}

function recording(frames, durationMs = 5_000) {
  return {
    schemaVersion: 1,
    id: '12345678-1234-4234-8234-123456789abc',
    observedAt: '2026-11-09T10:00:00.000Z',
    modelVersion: 'pose_landmarker_lite/float16/1',
    durationMs,
    isTruncated: false,
    frames,
  };
}

function cycle(taskId, side = 'left') {
  const protocol = getAngleObservationProtocol(taskId);
  const start = protocol.cycleStart === 'low' ? 5 : 165;
  const target = protocol.cycleStart === 'low' ? 165 : 70;
  return Array.from({ length: 50 }, (_, index) =>
    frame(taskId, index * 100, index < 10 || index >= 25 ? start : target, side),
  );
}

function session(taskId, side = 'left') {
  return {
    context: { taskId, patientId: patient.id, affectedSide: side },
    phase: 'finished',
    safetyStopReason: null,
  };
}

test('肩肘膝和躯干按各自定义计算，左右患侧和非方形画面角度正确', () => {
  for (const taskId of taskIds) {
    for (const side of ['left', 'right']) {
      for (const angle of [0, 30, 90, 135, 180]) {
        const sample = frame(taskId, 0, angle, side);
        assert.ok(Math.abs(getJointAngle(sample, side, taskId) - angle) < 1e-6);
        const center = getAngleObservationProtocol(taskId).leftIndices[1];
        sample.landmarks[center + (side === 'left' ? 0 : 1)].visibility = 0.49;
        assert.equal(getJointAngle(sample, side, taskId), null);
      }
    }
  }
});

test('肩前举下垂为零角度，手腕遮挡与退化骨段不会生成可用测量', () => {
  const sample = frame('shoulder_flexion', 0, 0);
  assert.equal(getJointAngle(sample, 'left', 'shoulder_flexion'), 0);
  sample.landmarks[15].presence = 0.1;
  assert.equal(getJointAngle(sample, 'left', 'shoulder_flexion'), null);
  const knee = frame('seated_knee_extension', 0, 160);
  knee.landmarks[27] = knee.landmarks[25];
  assert.equal(getJointAngle(knee, 'left', 'seated_knee_extension'), null);
});

test('四种任务仅计完整往返周期，暂停标记与长漏检均重置周期', () => {
  for (const taskId of taskIds) {
    for (const side of ['left', 'right']) {
      const frames = cycle(taskId, side);
      assert.equal(analyzeJoint(recording(frames), side, taskId).repetitions, 1);
      const paused = frames.map((entry, index) =>
        index === 23 ? { ...entry, isInPreview: false, landmarks: [] } : entry,
      );
      const result = analyzeJoint(recording(paused), side, taskId);
      assert.equal(result.repetitions, 0);
      assert.equal(result.series[23].angle, null);
      const gap = frames.filter((_, index) => index < 23 || index > 27);
      assert.equal(analyzeJoint(recording(gap), side, taskId).repetitions, 0);
    }
  }
});

test('低覆盖、容量截断与短采集保持空指标，真实无动作保留零周期', () => {
  for (const taskId of taskIds) {
    const clean = recording(Array.from({ length: 50 }, (_, i) => frame(taskId, i * 100, 90)));
    assert.equal(analyzeJoint(clean, 'left', taskId).repetitions, 0);
    for (const input of [
      recording([]),
      { ...clean, isTruncated: true },
      recording([frame(taskId, 0, 90)], 100),
      recording(Array.from({ length: 50 }, (_, i) => frame(taskId, i, 90))),
    ]) {
      const result = analyzeJoint(input, 'left', taskId);
      assert.equal(result.captureQuality, 'invalid_capture');
      assert.equal(result.rangeOfMotion, null);
      assert.equal(result.repetitions, null);
      assert.ok(result.series.every((sample) => sample.angle === null));
    }
  }
});

test('四种动作报告保存各自协议且可回读，拒绝错配协议和未知任务', () => {
  for (const taskId of taskIds) {
    for (const side of ['left', 'right']) {
      const report = createObservationReport(
        { ...patient, affectedSide: side },
        session(taskId, side),
        recording(cycle(taskId, side)),
        'completed',
        false,
      );
      assert.equal(report.taskId, taskId);
      assert.equal(report.protocolVersion, getAngleObservationProtocol(taskId).version);
      assert.deepEqual(parseObservationReport(report), report);
      const otherTask =
        taskId === 'shoulder_flexion' ? 'seated_knee_extension' : 'shoulder_flexion';
      assert.throws(() => parseObservationReport({ ...report, taskId: otherTask }));
    }
  }
  assert.throws(() =>
    createObservationReport(patient, session('unknown_task'), recording([]), 'completed', false),
  );
});

test('新增任务的完成状态与质量独立，辅助完成需与现场情况一致', () => {
  for (const taskId of ['shoulder_flexion', 'seated_knee_extension', 'seated_trunk_lean']) {
    const invalid = createObservationReport(
      patient,
      session(taskId),
      recording([]),
      'completed',
      false,
    );
    assert.equal(invalid.taskStatus, 'completed');
    assert.equal(invalid.captureQuality, 'invalid_capture');
    assert.deepEqual(parseObservationReport(invalid), invalid);
    assert.throws(() =>
      createObservationReport(
        patient,
        { ...session(taskId), phase: 'stopped_safety' },
        recording(cycle(taskId)),
        'completed',
        false,
      ),
    );
    assert.equal(
      createObservationReport(patient, session(taskId), recording([]), 'completed', true)
        .assistance,
      'manual_or_device',
    );
  }
});
