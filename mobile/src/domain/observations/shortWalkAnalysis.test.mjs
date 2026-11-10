import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';
import { walkMotion, walkRecording } from './shortWalkFixtures.mjs';

import { createObservationReport } from './recordingFixtures.mjs';
const { parseObservationReport } = await loadTypeScript(
  'src/domain/observations/observationParser.ts',
);
const { getObservationChanges } = await loadTypeScript(
  'src/domain/observations/observationHistory.ts',
);
const patient = { id: 'patient-1', patientCode: 'PA-01', revision: 1, affectedSide: 'left' };
const session = {
  phase: 'finished',
  context: { taskId: 'short_walk', patientId: patient.id, affectedSide: 'left' },
  safetyStopReason: null,
};
function reportFor(recording = walkRecording(), side = 'left') {
  return createObservationReport(
    { ...patient, affectedSide: side },
    { ...session, context: { ...session.context, affectedSide: side } },
    recording,
    'partial',
    false,
  );
}

test('步行双侧各三个完整周期；左右患侧、左右行进和横竖画幅一致且可回读', () => {
  for (const side of ['left', 'right']) {
    for (const speed of [-40, 40]) {
      for (const [width, height] of [
        [640, 480],
        [480, 640],
        [1080, 1920],
      ]) {
        const report = reportFor(walkRecording(undefined, { speed, width, height }), side);
        const metrics = report.taskAnalysis.taskResult.metrics;
        assert.equal(report.captureQuality, 'valid');
        assert.equal(report.repetitions, 3);
        assert.equal(metrics.leftCycles, 3);
        assert.equal(metrics.rightCycles, 3);
        assert.equal(metrics.meanLeftCycleDurationMs, 1600);
        assert.equal(metrics.meanRightCycleDurationMs, 1600);
        assert.ok(Math.abs(metrics.kneeRangeDifference) < 1e-6);
        assert.equal(metrics.cycleDurationDifferenceMs, 0);
        assert.equal(report.protocolVersion, 'walk-straight-side-v1');
        assert.equal(report.analysisVersion, 'walk-knee-cycle-2d-v1');
        assert.equal(report.taskStatus, 'partial');
        assert.deepEqual(parseObservationReport(report), report);
      }
    }
  }
});

test('站立、原地踏步、同步双腿运动、单次摆动和小幅屈膝不生成步行周期', () => {
  for (const recording of [
    walkRecording(Array(60).fill({ left: 170, right: 170 })),
    walkRecording(undefined, { speed: 0 }),
    walkRecording(walkMotion().map(({ left }) => ({ left, right: left }))),
    walkRecording(walkMotion(1)),
    walkRecording(
      walkMotion().map(({ left, right }) => ({
        left: Math.max(145, left),
        right: Math.max(145, right),
      })),
    ),
  ]) {
    const report = reportFor(recording);
    assert.equal(report.taskAnalysis.taskResult.metrics.leftCycles, 0);
    assert.equal(report.taskAnalysis.taskResult.metrics.rightCycles, 0);
    assert.equal(report.taskAnalysis.taskResult.metrics.meanLeftCycleDurationMs, null);
    assert.equal(report.taskAnalysis.taskResult.metrics.cycleDurationDifferenceMs, null);
    assert.deepEqual(parseObservationReport(report), report);
  }
});

test('双侧范围差保留方向，只有单侧周期时另侧耗时和耗时差为 null', () => {
  const recording = walkRecording(
    walkMotion().map(({ left, right }) => ({ left, right: Math.max(145, right) })),
  );
  const report = reportFor(recording);
  assert.equal(report.taskAnalysis.taskResult.metrics.leftCycles, 3);
  assert.equal(report.taskAnalysis.taskResult.metrics.rightCycles, 0);
  assert.equal(report.taskAnalysis.taskResult.metrics.meanRightCycleDurationMs, null);
  assert.equal(report.taskAnalysis.taskResult.metrics.cycleDurationDifferenceMs, null);
  assert.ok(report.taskAnalysis.taskResult.metrics.kneeRangeDifference > 20);
  assert.deepEqual(parseObservationReport(report), report);
});

test('暂停、漏检、长间隔、遮挡、画幅变化与相机突移不跨段拼接周期', () => {
  const original = walkRecording(walkMotion(2));
  const variants = [
    {
      ...original,
      frames: original.frames.map((frame, i) => (i === 22 ? { ...frame, landmarks: [] } : frame)),
    },
    { ...original, frames: original.frames.filter((_, i) => i < 21 || i > 24) },
    {
      ...original,
      frames: original.frames.map((frame, i) =>
        i === 22 ? { ...frame, isInPreview: false } : frame,
      ),
    },
  ];
  for (const landmark of [11, 12, 23, 24, 25, 26, 27, 28]) {
    const changed = structuredClone(original);
    changed.frames[22].landmarks[landmark].visibility = 0;
    variants.push(changed);
  }
  for (const change of [
    (frame) => {
      frame.imageWidth += 1;
    },
    (frame) => {
      frame.landmarks.forEach((point) => {
        point.x += 0.2;
      });
    },
    (frame) => {
      frame.landmarks.forEach((point) => {
        point.y -= 0.15;
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
    changed.frames.slice(22).forEach(change);
    variants.push(changed);
  }
  for (const recording of variants) {
    const report = reportFor(recording);
    assert.equal(report.repetitions, 0);
    assert.equal(report.taskAnalysis.taskResult.metrics.rightCycles, 0);
    assert.deepEqual(parseObservationReport(report), report);
  }
});

test('原路折返不作为持续前进；半程开始、未完成及过慢周期不累计', () => {
  const recording = walkRecording(walkMotion(2));
  // 左侧两峰之间先前进再回退，不能把往返位移相加当作直线前进。
  recording.frames.forEach((frame, i) => {
    const desired = i < 17 ? i * 8 : 136 - (i - 17) * 8;
    const originalX = i * 4;
    frame.landmarks.forEach((point) => {
      point.x += (desired - originalX) / frame.imageWidth;
    });
  });
  assert.equal(reportFor(recording).repetitions, 0);
  // 直接扩展周期采样，持续超过 6 秒时即使位移充足也不拼接。
  const longMotion = walkMotion(2).flatMap((angles) => Array(5).fill(angles));
  const longRecording = walkRecording(longMotion, { speed: 7 });
  assert.equal(reportFor(longRecording).repetitions, 0);
  const partial = reportFor(walkRecording(walkMotion(2).slice(10, 38)));
  assert.equal(partial.captureQuality, 'valid');
  assert.equal(partial.repetitions, 0);
  assert.deepEqual(parseObservationReport(partial), partial);
});

test('不等间隔采样、停顿后恢复和左右耗时差按真实时间计算', () => {
  const jitter = walkRecording();
  jitter.frames = jitter.frames.map((frame, index) => ({
    ...frame,
    timestampMs: index * 97 + (index % 3) * 3,
  }));
  jitter.durationMs = jitter.frames.at(-1).timestampMs + 100;
  const jitterReport = reportFor(jitter);
  assert.equal(jitterReport.repetitions, 3);
  assert.deepEqual(parseObservationReport(jitterReport), jitterReport);
  const recovered = walkRecording([...walkMotion(2), ...walkMotion(2)]);
  recovered.frames[22].landmarks = [];
  const recoveredReport = reportFor(recovered);
  assert.equal(recoveredReport.repetitions, 1);
  const leftCycle = recoveredReport.taskAnalysis.taskResult.metrics.cycles.find(
    (cycle) => cycle.side === 'left',
  );
  assert.ok(leftCycle.startedAtMs > 2200);
  assert.deepEqual(parseObservationReport(recoveredReport), recoveredReport);
  const motion = walkMotion();
  const unequal = walkRecording([
    ...motion.slice(0, 62),
    ...Array(4).fill({ left: 170, right: 170 }),
    ...motion.slice(62),
  ]);
  const unequalReport = reportFor(unequal);
  const metrics = unequalReport.taskAnalysis.taskResult.metrics;
  assert.equal(metrics.leftCycles, 3);
  assert.equal(metrics.rightCycles, 3);
  assert.ok(metrics.cycleDurationDifferenceMs < -100);
  assert.equal(
    metrics.cycleDurationDifferenceMs,
    metrics.meanLeftCycleDurationMs - metrics.meanRightCycleDurationMs,
  );
  assert.deepEqual(parseObservationReport(unequalReport), unequalReport);
});

test('缺失、短采集和截断不显示指标，辅助和不再创建安全停止结果', () => {
  for (const recording of [
    { ...walkRecording(), frames: [] },
    { ...walkRecording(), isTruncated: true },
    walkRecording(walkMotion().slice(0, 10)),
    {
      ...walkRecording(),
      frames: walkRecording().frames.map((frame, i) =>
        i < 65 ? { ...frame, landmarks: [] } : frame,
      ),
    },
  ]) {
    const report = reportFor(recording);
    assert.equal(report.captureQuality, 'invalid_capture');
    assert.equal(report.repetitions, null);
    assert.equal(report.taskAnalysis.taskResult.metrics.leftCycles, null);
    assert.equal(report.taskAnalysis.taskResult.metrics.leftKneeRange, null);
    assert.equal(report.taskStatus, 'partial');
    assert.deepEqual(parseObservationReport(report), report);
  }
  const assisted = createObservationReport(patient, session, walkRecording(), 'assisted', true);
  assert.deepEqual(parseObservationReport(assisted), assisted);
  assert.throws(() =>
    createObservationReport(
      patient,
      { ...session, phase: 'stopped_safety' },
      walkRecording(),
      'completed',
      false,
    ),
  );
});

test('报告边界按双侧时序重算周期，拒绝伪造时间、次数、侧别、位移和汇总', () => {
  const original = reportFor();
  for (const change of [
    (entry) => {
      delete entry.taskAnalysis.taskResult.metrics;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.cycles = [];
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.cycles[0].side = 'right';
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.cycles[0].startedAtMs++;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.cycles[0].extensionAtMs = 0;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.cycles[0].confirmedAtMs = 2500;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.cycles[0].travelRatio = 0.01;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.leftCycles++;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.meanLeftCycleDurationMs++;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.leftKneeRange++;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.kneeRangeDifference++;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.cycleDurationDifferenceMs++;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.samples[12].leftKneeAngle++;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.samples[12].rightKneeAngle = null;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.samples[12].segmentIndex++;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.samples[12].timestampMs++;
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics.samples.forEach((sample) => {
        sample.hipOffsetRatio = 0;
      });
    },
    (entry) => {
      entry.taskAnalysis.taskResult.metrics = {};
    },
  ]) {
    const changed = structuredClone(original);
    change(changed);
    assert.throws(() => parseObservationReport(changed));
  }
  const invalid = reportFor({ ...walkRecording(), frames: [] });
  invalid.taskAnalysis.taskResult.metrics.leftCycles = 0;
  assert.throws(() => parseObservationReport(invalid));
});

test('历史比较保留零值和缺失耗时，双侧差异按较晚减较早', () => {
  const still = reportFor(walkRecording(Array(76).fill({ left: 170, right: 170 }), { speed: 0 }));
  const later = { ...reportFor(), id: 'later', observedAt: '2026-11-09T11:00:00Z' };
  const changes = getObservationChanges(later, still);
  assert.deepEqual(changes.issues, []);
  assert.deepEqual(
    changes.metrics.slice(-8, -4).map((metric) => metric.change),
    [3, 3, null, null],
  );
  assert.equal(changes.metrics.at(-1).change, null);
});

test('最大帧数报告保留全部周期，持久化精度可重算且不丢失时序', () => {
  const recording = walkRecording(walkMotion(562), {
    width: 16384,
    height: 16384,
    speed: 40,
    scale: 0.1,
  });
  recording.frames = recording.frames.slice(0, 9000);
  recording.durationMs = 900000;
  const report = reportFor(recording);
  assert.equal(report.captureQuality, 'valid');
  assert.equal(report.taskAnalysis.taskResult.metrics.samples.length, 9000);
  assert.ok(report.taskAnalysis.taskResult.metrics.cycles.length > 1000);
  assert.ok(Buffer.byteLength(JSON.stringify(report)) < 1_800_000);
  assert.deepEqual(parseObservationReport(report), report);
});
