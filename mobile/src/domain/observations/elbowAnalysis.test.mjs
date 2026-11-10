import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';
import { createObservationReport } from './recordingFixtures.mjs';

const { analyzeElbow, getElbowAngle } = await loadTypeScript(
  'src/domain/observations/elbowAnalysis.ts',
);
const { parsePoseRecording } = await loadTypeScript(
  'src/domain/observations/legacyPoseRecording.ts',
);
const { parseObservationReport } = await loadTypeScript(
  'src/domain/observations/observationParser.ts',
);
const { createCaptureSession, transitionCaptureSession } = await loadTypeScript(
  'src/domain/capture/captureSession.ts',
);

function frame(timestampMs, degrees = 160, side = 'left') {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
    presence: 1,
  }));
  const offset = side === 'left' ? 0 : 1;
  const radians = (degrees * Math.PI) / 180;
  landmarks[11 + offset] = { x: 0.5, y: 0.3, visibility: 1, presence: 1 };
  landmarks[15 + offset] = {
    x: 0.5 + (Math.sin(radians) * 96) / 640,
    y: 0.5 - (Math.cos(radians) * 96) / 480,
    visibility: 1,
    presence: 1,
  };
  return { timestampMs, imageWidth: 640, imageHeight: 480, isInPreview: true, landmarks };
}

function recording(frames, durationMs = 4_000) {
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
const clean = recording(Array.from({ length: 40 }, (_, i) => frame(i * 100)));
const patient = { id: 'patient-1', patientCode: 'PA-01', affectedSide: 'left', revision: 1 };
const context = {
  patientId: 'patient-1',
  taskId: 'elbow_flexion_extension',
  affectedSide: 'left',
};
const readiness = {
  hasPatient: true,
  isAppActive: true,
  hasSafetyConfirmation: true,
};
const started = transitionCaptureSession(createCaptureSession(context), {
  type: 'start',
  atMs: 1_000,
  readiness,
});
const finished = transitionCaptureSession(started, { type: 'finish', atMs: 5_000 });

test('肘角恢复图像宽高比，左右侧正确且拒绝低置信度和退化骨段', () => {
  for (const side of ['left', 'right']) {
    for (const degrees of [0, 40, 90, 135, 180]) {
      assert.ok(Math.abs(getElbowAngle(frame(0, degrees, side), side) - degrees) < 1e-6);
    }
  }
  const hidden = frame(0);
  hidden.landmarks[13].visibility = 0.49;
  assert.equal(getElbowAngle(hidden, 'left'), null);
  const degenerate = frame(0);
  degenerate.landmarks[11] = degenerate.landmarks[13];
  assert.equal(getElbowAngle(degenerate, 'left'), null);
  assert.equal(getElbowAngle({ ...frame(0), isInPreview: false }, 'left'), null);
});

test('真实零周期与缺失指标区分，低覆盖和截断不展示可信指标', () => {
  const valid = analyzeElbow(clean, 'left');
  assert.equal(valid.captureQuality, 'valid');
  assert.equal(valid.repetitions, 0);
  assert.ok(Math.abs(valid.rangeOfMotion) < 1e-6);
  for (const input of [
    recording([]),
    recording([frame(0)], 100),
    { ...clean, isTruncated: true },
  ]) {
    const invalid = analyzeElbow(input, 'left');
    assert.equal(invalid.captureQuality, 'invalid_capture');
    assert.equal(invalid.rangeOfMotion, null);
    assert.equal(invalid.repetitions, null);
    assert.ok(invalid.series.every((sample) => sample.angle === null));
  }
});

test('周期需要伸展、屈曲、回伸，缺失区间与暂停不能跨段凑出周期', () => {
  const cycle = Array.from({ length: 40 }, (_, i) => frame(i * 100, i < 10 || i >= 25 ? 165 : 70));
  assert.equal(analyzeElbow(recording(cycle), 'left').repetitions, 1);
  const interrupted = cycle.map((entry, i) =>
    i === 23 ? { ...entry, isInPreview: false } : entry,
  );
  assert.equal(analyzeElbow(recording(interrupted), 'left').repetitions, 0);
  assert.equal(analyzeElbow(recording(interrupted), 'left').series[23].angle, null);
  const jump = cycle.filter((_, i) => i < 23 || i > 27);
  assert.equal(analyzeElbow(recording(jump), 'left').repetitions, 0);
});

test('覆盖率按时间计算，长漏检降级，集中在短时间内的多帧不能冒充有效采集', () => {
  const gap = clean.frames.map((entry, i) =>
    i >= 15 && i <= 22 ? { ...entry, isInPreview: false } : entry,
  );
  const result = analyzeElbow(recording(gap), 'left');
  assert.equal(result.captureQuality, 'degraded');
  assert.equal(result.longestGapMs, 900);
  assert.ok(result.coverage < 0.85 && result.coverage >= 0.5);
  const burst = recording(
    Array.from({ length: 40 }, (_, i) => frame(i)),
    4_000,
  );
  assert.equal(analyzeElbow(burst, 'left').captureQuality, 'invalid_capture');
});

test('原生关键点边界拒绝乱序、越界时间、缺少点数与非有限坐标', () => {
  assert.equal(parsePoseRecording(clean).frames.length, 40);
  for (const input of [
    { ...clean, frames: [frame(100), frame(100)] },
    { ...clean, frames: [frame(4_001)] },
    { ...clean, frames: [{ ...frame(0), landmarks: [{}] }] },
    { ...clean, frames: [frame(0), { ...frame(100), imageWidth: NaN }] },
    { ...clean, id: '../../escape' },
  ])
    assert.throws(() => parsePoseRecording(input));
});

test('任务状态人工确认且与采集质量独立，不创建安全停止报告', () => {
  assert.throws(() => createObservationReport(patient, finished, clean, null, false));
  assert.throws(() => createObservationReport(patient, finished, clean, 'completed', true));
  assert.throws(() =>
    createObservationReport({ ...patient, id: 'design-1' }, finished, clean, 'completed', false),
  );
  const invalid = createObservationReport(patient, finished, recording([]), 'completed', false);
  assert.equal(invalid.taskStatus, 'completed');
  assert.equal(invalid.captureQuality, 'invalid_capture');
  assert.throws(() =>
    createObservationReport(
      patient,
      { ...finished, phase: 'stopped_safety' },
      clean,
      'completed',
      false,
    ),
  );
  const report = createObservationReport(patient, finished, clean, 'completed', false);
  assert.deepEqual(parseObservationReport(report), report);
  assert.throws(() => parseObservationReport({ ...report, captureQuality: 'invalid_capture' }));
});

test('报告回读拒绝不一致的活动范围、空指标、协议和辅助状态', () => {
  const report = createObservationReport(patient, finished, clean, 'completed', false);
  for (const invalid of [
    { ...report, protocolVersion: 'other' },
    { ...report, assistance: 'manual_or_device' },
    { ...report, patientRevision: 1.5 },
    {
      ...report,
      taskAnalysis: {
        ...report.taskAnalysis,
        taskResult: {
          ...report.taskAnalysis.taskResult,
          angle: { ...report.taskAnalysis.taskResult.angle, minAngle: null },
        },
      },
    },
    {
      ...report,
      taskAnalysis: {
        ...report.taskAnalysis,
        taskResult: {
          ...report.taskAnalysis.taskResult,
          angle: { ...report.taskAnalysis.taskResult.angle, rangeOfMotion: 90 },
        },
      },
    },
    {
      ...report,
      taskAnalysis: {
        ...report.taskAnalysis,
        qualityAssessment: { ...report.taskAnalysis.qualityAssessment, validSampleCount: 1 },
      },
    },
    {
      ...report,
      taskAnalysis: {
        ...report.taskAnalysis,
        commonMetrics: { ...report.taskAnalysis.commonMetrics, repetitions: 0.5 },
      },
    },
  ])
    assert.throws(() => parseObservationReport(invalid));
});
