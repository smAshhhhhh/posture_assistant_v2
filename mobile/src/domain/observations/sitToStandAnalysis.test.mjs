import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';
import { sitToStandMotion, sitToStandRecording } from './sitToStandFixtures.mjs';
import { createObservationReport } from './recordingFixtures.mjs';

const { analyzeSitToStand } = await loadTypeScript('src/domain/observations/sitToStandAnalysis.ts');
const { parseObservationReport } = await loadTypeScript(
  'src/domain/observations/observationParser.ts',
);
const { getObservationChanges } = await loadTypeScript(
  'src/domain/observations/observationHistory.ts',
);

const patient = { id: 'patient-1', patientCode: 'PA-01', revision: 1, affectedSide: 'left' };
const session = {
  phase: 'finished',
  context: { taskId: 'sit_to_stand', patientId: patient.id, affectedSide: 'left' },
  safetyStopReason: null,
};

test('坐站完整往返按患侧计数，左右侧、画幅和阶段耗时可回读', () => {
  for (const side of ['left', 'right']) {
    for (const [width, height] of [
      [640, 480],
      [480, 640],
      [1080, 1920],
    ]) {
      const recording = sitToStandRecording(sitToStandMotion(), { side, width, height });
      const analysis = analyzeSitToStand(recording, side);
      assert.equal(analysis.captureQuality, 'valid');
      assert.equal(analysis.repetitions, 1);
      assert.equal(analysis.sitToStand.cycles.length, 1);
      assert.ok(analysis.sitToStand.meanRiseDurationMs > 0);
      assert.ok(analysis.sitToStand.meanDescentDurationMs > 0);
      const report = createObservationReport(
        { ...patient, affectedSide: side },
        { ...session, context: { ...session.context, affectedSide: side } },
        recording,
        'partial',
        false,
      );
      assert.equal(report.repetitions, 1);
      assert.equal(report.taskStatus, 'partial');
      assert.equal(report.protocolVersion, 'sit-stand-side-v1');
      assert.equal(report.analysisVersion, 'sit-stand-2d-v1');
      assert.deepEqual(parseObservationReport(report), report);
    }
  }
});

test('采样间隔波动仍可回读阶段，不要求稳定确认恰好落在整百毫秒', () => {
  const recording = sitToStandRecording();
  recording.frames = recording.frames.map((frame, index) => ({
    ...frame,
    timestampMs: index * 93 + (index % 3) * 4,
  }));
  recording.durationMs = recording.frames.at(-1).timestampMs + 100;
  const report = createObservationReport(patient, session, recording, 'completed', false);
  assert.equal(report.repetitions, 1);
  assert.deepEqual(parseObservationReport(report), report);
});

test('多次坐站统计完整往返，静坐和未完成动作保留零次与缺失耗时', () => {
  assert.equal(
    analyzeSitToStand(sitToStandRecording([...sitToStandMotion(), ...sitToStandMotion()]), 'left')
      .repetitions,
    2,
  );
  for (const angles of [
    Array(40).fill(90),
    Array(40).fill(170),
    [...Array(10).fill(90), ...Array(25).fill(170)],
    [...Array(10).fill(170), ...Array(25).fill(90)],
    [...Array(10).fill(90), ...Array(15).fill(140), ...Array(10).fill(90)],
    [...Array(10).fill(90), ...[140, 170, 140], ...Array(15).fill(90)],
  ]) {
    const result = analyzeSitToStand(sitToStandRecording(angles), 'left');
    assert.equal(result.repetitions, 0);
    assert.equal(result.sitToStand.meanRiseDurationMs, null);
    assert.equal(result.sitToStand.meanDescentDurationMs, null);
  }
});

test('坐姿伸膝但髋部没有抬升，不会误记坐站', () => {
  const recording = sitToStandRecording();
  for (const sample of recording.frames) {
    // 将腿部骨段整体转向侧面，髋踝垂直距离维持初始坐姿高度。
    const hip = sample.landmarks[23];
    const ankle = sample.landmarks[27];
    const theta = Math.atan2(hip.x - ankle.x, ankle.y - hip.y);
    const length = Math.hypot(hip.x - ankle.x, hip.y - ankle.y);
    const target = Math.acos(Math.min(1, 100 / sample.imageHeight / length));
    const rotation = target - theta;
    for (const index of [23, 25]) {
      const point = sample.landmarks[index];
      const x = (point.x - ankle.x) * sample.imageWidth;
      const y = (point.y - ankle.y) * sample.imageHeight;
      point.x = ankle.x + (x * Math.cos(rotation) - y * Math.sin(rotation)) / sample.imageWidth;
      point.y = ankle.y + (x * Math.sin(rotation) + y * Math.cos(rotation)) / sample.imageHeight;
    }
  }
  assert.equal(analyzeSitToStand(recording, 'left').repetitions, 0);
});

test('暂停、漏检、双侧关节遮挡和机位移动不跨缺失拼成坐站', () => {
  const original = sitToStandRecording();
  const variants = [
    {
      ...original,
      frames: original.frames.map((frame, index) =>
        index === 22 ? { ...frame, landmarks: [] } : frame,
      ),
    },
    { ...original, frames: original.frames.filter((_, index) => index < 21 || index > 24) },
    {
      ...original,
      frames: original.frames.map((frame, index) =>
        index === 22 ? { ...frame, isInPreview: false } : frame,
      ),
    },
  ];
  for (const point of [11, 12, 23, 24, 25, 26, 27, 28]) {
    const hidden = structuredClone(original);
    hidden.frames[22].landmarks[point].visibility = 0.1;
    variants.push(hidden);
  }
  const moved = structuredClone(original);
  for (const frame of moved.frames.slice(22)) {
    for (const point of frame.landmarks) point.x += 0.15;
  }
  variants.push(moved);
  for (const change of [
    (frame) => {
      frame.imageWidth += 1;
    },
    (frame) => {
      const ankle = frame.landmarks[27];
      for (const point of [frame.landmarks[23], frame.landmarks[25]]) {
        point.x = ankle.x + (point.x - ankle.x) * 1.5;
        point.y = ankle.y + (point.y - ankle.y) * 1.5;
      }
    },
  ]) {
    const incompatible = structuredClone(original);
    incompatible.frames.slice(22).forEach(change);
    variants.push(incompatible);
  }
  for (const recording of variants) {
    const result = analyzeSitToStand(recording, 'left');
    assert.equal(result.repetitions, 0);
    assert.equal(result.sitToStand.meanRiseDurationMs, null);
  }
});

test('低质量、短采集和容量截断没有虚假次数或耗时，不再创建安全停止结果', () => {
  const original = sitToStandRecording();
  for (const recording of [
    { ...original, isTruncated: true },
    sitToStandRecording([90, 170, 90]),
    { ...original, frames: [] },
    {
      ...original,
      frames: original.frames.map((frame, index) =>
        index < 30 ? { ...frame, landmarks: [] } : frame,
      ),
    },
  ]) {
    const report = createObservationReport(patient, session, recording, 'completed', false);
    assert.equal(report.taskStatus, 'completed');
    assert.equal(report.captureQuality, 'invalid_capture');
    assert.equal(report.repetitions, null);
    assert.equal(report.taskAnalysis.taskResult.metrics.meanRiseDurationMs, null);
    assert.deepEqual(parseObservationReport(report), report);
  }
  assert.throws(() =>
    createObservationReport(
      patient,
      { ...session, phase: 'stopped_safety' },
      original,
      'completed',
      false,
    ),
  );
});

test('坐站回读拒绝错序、缺失证据、虚假次数和平均值，零周期也可对比', () => {
  const report = createObservationReport(
    patient,
    session,
    sitToStandRecording(),
    'completed',
    false,
  );
  for (const change of [
    (entry) => {
      delete entry.taskAnalysis.taskResult.metrics;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.cycles[0].standingAtMs = 0;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.meanRiseDurationMs += 1;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.cycles = [];
    },
    (entry) => {
      entry.taskAnalysis.taskResult.angle.series[17].angle = null;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.cycles.push({
        ...entry.taskAnalysis.taskResult.metrics.cycles[0],
      });
      entry.taskAnalysis.commonMetrics.repetitions = 2;
      entry.repetitions = 2;
    },
  ]) {
    const changed = structuredClone(report);
    change(changed);
    assert.throws(() => parseObservationReport(changed));
  }
  const still = createObservationReport(
    patient,
    session,
    sitToStandRecording(Array(40).fill(90)),
    'partial',
    false,
  );
  const changes = getObservationChanges(still, {
    ...report,
    id: 'later',
    observedAt: '2026-11-09T11:00:00.000Z',
  });
  assert.deepEqual(changes.issues, []);
  assert.deepEqual(
    changes.metrics.slice(-2).map((metric) => metric.change),
    [null, null],
  );
  assert.deepEqual(
    changes.metrics.slice(-2).map((metric) => metric.label),
    ['平均起身耗时', '平均坐回耗时'],
  );
  const same = getObservationChanges(report, {
    ...report,
    id: 'repeat',
    observedAt: '2026-11-09T12:00:00.000Z',
  });
  assert.deepEqual(
    same.metrics.slice(-2).map((metric) => metric.change),
    [0, 0],
  );
  const assisted = createObservationReport(
    patient,
    session,
    sitToStandRecording(),
    'assisted',
    true,
  );
  assert.deepEqual(parseObservationReport(assisted), assisted);
  assert.ok(getObservationChanges(report, assisted).issues.length > 0);
});
