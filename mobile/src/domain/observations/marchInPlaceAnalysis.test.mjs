import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';
import { marchMotion, marchRecording } from './marchInPlaceFixtures.mjs';

const { analyzeMarchInPlace } = await loadTypeScript(
  'src/domain/observations/marchInPlaceAnalysis.ts',
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
const patient = { id: 'patient-1', patientCode: 'PA-01', revision: 1, affectedSide: 'left' };
const session = {
  phase: 'finished',
  context: { taskId: 'march_in_place', patientId: patient.id, affectedSide: 'left' },
  safetyStopReason: null,
};
const reportFor = (recording = marchRecording()) =>
  createObservationReport(patient, session, recording, 'partial', false);

test('原地踏步左右患侧和非方形画幅均记录完整四步、耗时和全程步频', () => {
  for (const side of ['left', 'right']) {
    for (const [width, height] of [
      [640, 480],
      [480, 640],
      [1080, 1920],
    ]) {
      const recording = marchRecording(undefined, { width, height });
      const report = createObservationReport(
        { ...patient, affectedSide: side },
        { ...session, context: { ...session.context, affectedSide: side } },
        recording,
        'partial',
        false,
      );
      const metrics = report.analysis.marchInPlace;
      assert.equal(report.captureQuality, 'valid');
      assert.equal(report.repetitions, 4);
      assert.equal(metrics.leftSteps, 2);
      assert.equal(metrics.rightSteps, 2);
      assert.equal(metrics.alternationErrors, 0);
      assert.equal(metrics.meanStepDurationMs, 500);
      assert.equal(metrics.cadencePerMinute, 50);
      assert.ok(metrics.steps.every((step) => Math.abs(step.liftRatio - 0.16) < 1e-6));
      assert.equal(report.protocolVersion, 'march-standing-side-v1');
      assert.equal(report.analysisVersion, 'march-alternation-2d-v1');
      assert.equal(report.taskStatus, 'partial');
      assert.deepEqual(parseObservationReport(report), report);
    }
  }
});

test('同侧连续抬脚保留真实步数，并单独记录交替异常', () => {
  const analysis = analyzeMarchInPlace(
    marchRecording(marchMotion(['left', 'left', 'right'])),
    'left',
  );
  assert.equal(analysis.repetitions, 3);
  assert.equal(analysis.marchInPlace.leftSteps, 2);
  assert.equal(analysis.marchInPlace.rightSteps, 1);
  assert.equal(analysis.marchInPlace.alternationErrors, 1);
});

test('静止、小摆动和只抬不落保持零步；半途开始必须先回到站姿建立基线', () => {
  for (const motion of [
    Array(40).fill({}),
    [...Array(8).fill({}), ...Array(24).fill({ left: 0.06 }), ...Array(8).fill({})],
    [...Array(8).fill({}), ...Array(32).fill({ left: 0.16 })],
    [...Array(20).fill({ left: 0.16 }), ...Array(20).fill({})],
  ]) {
    const report = reportFor(marchRecording(motion));
    assert.equal(report.repetitions, 0);
    assert.equal(report.analysis.marchInPlace.meanStepDurationMs, null);
    assert.equal(report.analysis.marchInPlace.cadencePerMinute, null);
    assert.deepEqual(parseObservationReport(report), report);
  }
});

test('双脚同时抬升不计两步；不稳定站姿和始终抬脚不能建立站立基线', () => {
  const both = marchMotion(['left', 'left']).map((lift) => ({
    left: lift.left ?? 0,
    right: lift.left ?? 0,
  }));
  assert.equal(analyzeMarchInPlace(marchRecording(both), 'left').repetitions, 0);
  for (const recording of [
    marchRecording(Array(40).fill({ left: 0.16 })),
    {
      ...marchRecording(),
      frames: marchRecording().frames.map((frame, index) => ({
        ...frame,
        landmarks: frame.landmarks.map((point) => ({ ...point, y: point.y + (index % 2) * 0.02 })),
      })),
    },
  ])
    assert.equal(analyzeMarchInPlace(recording, 'left').repetitions, null);
});

test('暂停、长间隔、关节遮挡、画幅缩放和机位移动不会拼接未完成的一步', () => {
  const original = marchRecording(marchMotion(['left']));
  const variants = [
    {
      ...original,
      frames: original.frames.map((frame, i) => (i === 11 ? { ...frame, landmarks: [] } : frame)),
    },
    { ...original, frames: original.frames.filter((_, i) => i < 10 || i > 12) },
    {
      ...original,
      frames: original.frames.map((frame, i) =>
        i === 11 ? { ...frame, isInPreview: false } : frame,
      ),
    },
  ];
  for (const landmark of [11, 12, 23, 24, 25, 26, 27, 28]) {
    const hidden = structuredClone(original);
    hidden.frames[11].landmarks[landmark].visibility = 0;
    variants.push(hidden);
  }
  for (const change of [
    (frame) => {
      frame.imageWidth += 1;
    },
    (frame) => {
      frame.landmarks.forEach((point) => {
        point.x += 0.15;
      });
    },
    (frame) => {
      frame.landmarks.forEach((point) => {
        point.y -= 0.12;
      });
    },
    (frame) => {
      frame.landmarks.forEach((point) => {
        point.x *= 0.7;
        point.y *= 0.7;
      });
    },
  ]) {
    const changed = structuredClone(original);
    changed.frames.slice(11).forEach(change);
    variants.push(changed);
  }
  for (const recording of variants) {
    const report = reportFor(recording);
    assert.equal(report.repetitions, 0);
    assert.deepEqual(parseObservationReport(report), report);
  }
});

test('中断后重新站稳再踏步，不跨段计算同侧连续', () => {
  const motion = [...marchMotion(['left']), {}, ...marchMotion(['left'])];
  const recording = marchRecording(motion);
  recording.frames[24].landmarks = [];
  const report = reportFor(recording);
  assert.equal(report.repetitions, 2);
  assert.equal(report.analysis.marchInPlace.alternationErrors, 0);
  assert.notEqual(
    report.analysis.marchInPlace.steps[0].segmentIndex,
    report.analysis.marchInPlace.steps[1].segmentIndex,
  );
  assert.deepEqual(parseObservationReport(report), report);
});

test('短采集、截断和缺失数据保持 null；人工完成、辅助和安全状态独立', () => {
  const original = marchRecording();
  for (const recording of [
    { ...original, isTruncated: true },
    { ...original, frames: [] },
    marchRecording([{}, { left: 0.16 }, {}]),
    {
      ...original,
      frames: original.frames.map((frame, i) => (i < 35 ? { ...frame, landmarks: [] } : frame)),
    },
  ]) {
    const report = createObservationReport(patient, session, recording, 'completed', false);
    assert.equal(report.taskStatus, 'completed');
    assert.equal(report.captureQuality, 'invalid_capture');
    assert.equal(report.repetitions, null);
    assert.equal(report.analysis.marchInPlace.leftSteps, null);
    assert.equal(report.analysis.marchInPlace.rightSteps, null);
    assert.equal(report.analysis.marchInPlace.alternationErrors, null);
    assert.deepEqual(parseObservationReport(report), report);
  }
  const assisted = createObservationReport(patient, session, original, 'assisted', true);
  assert.equal(assisted.taskStatus, 'assisted');
  assert.equal(assisted.repetitions, 4);
  assert.deepEqual(parseObservationReport(assisted), assisted);
  const safe = createObservationReport(
    patient,
    { ...session, phase: 'stopped_safety', safetyStopReason: 'pain' },
    original,
    'completed',
    false,
  );
  assert.equal(safe.taskStatus, 'stopped_safety');
  assert.deepEqual(parseObservationReport(safe), safe);
  assert.ok(getObservationChanges(safe, assisted).issues.length > 0);
});

test('回读拒绝缺失指标、错序、重叠、虚假统计、侧别和时间证据', () => {
  const report = reportFor();
  for (const change of [
    (entry) => {
      delete entry.analysis.marchInPlace;
    },
    (entry) => {
      entry.analysis.marchInPlace.steps = [];
    },
    (entry) => {
      entry.analysis.marchInPlace.leftSteps++;
    },
    (entry) => {
      entry.analysis.marchInPlace.meanStepDurationMs++;
    },
    (entry) => {
      entry.analysis.marchInPlace.cadencePerMinute++;
    },
    (entry) => {
      entry.analysis.marchInPlace.steps[0].side = 'both';
    },
    (entry) => {
      entry.analysis.marchInPlace.steps[0].segmentIndex = -1;
    },
    (entry) => {
      entry.analysis.marchInPlace.steps[1].segmentIndex++;
    },
    (entry) => {
      entry.analysis.marchInPlace.steps[0].liftRatio = 0.01;
    },
    (entry) => {
      entry.analysis.marchInPlace.steps[0].peakAtMs = 0;
    },
    (entry) => {
      entry.analysis.marchInPlace.steps[1].startedAtMs = 1000;
    },
    (entry) => {
      entry.analysis.marchInPlace.steps[0].startedAtMs++;
    },
    (entry) => {
      entry.analysis.marchInPlace.steps[0].endedAtMs = entry.durationMs;
    },
    (entry) => {
      entry.analysis.series[11].angle = null;
    },
    (entry) => {
      entry.analysis.sitToStand = {};
    },
  ]) {
    const changed = structuredClone(report);
    change(changed);
    assert.throws(() => parseObservationReport(changed));
  }
  const invalid = reportFor({ ...marchRecording(), frames: [] });
  invalid.analysis.marchInPlace.leftSteps = 0;
  assert.throws(() => parseObservationReport(invalid));
});

test('历史对比保留零步与缺失耗时，按时间顺序提供双侧和交替统计', () => {
  const still = reportFor(marchRecording(Array(48).fill({})));
  const later = { ...reportFor(), id: 'later', observedAt: '2026-11-09T11:00:00Z' };
  const changes = getObservationChanges(later, still);
  assert.deepEqual(changes.issues, []);
  assert.deepEqual(
    changes.metrics.slice(-5).map((metric) => metric.change),
    [2, 2, 0, null, null],
  );
  assert.deepEqual(
    changes.metrics.slice(-5).map((metric) => metric.label),
    ['左脚', '右脚', '连续同侧', '平均单步耗时', '全程平均步频'],
  );
});
