import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';
import { toCurrentRecording } from './recordingFixtures.mjs';
import { sitToStandRecording } from './sitToStandFixtures.mjs';
import { marchRecording } from './marchInPlaceFixtures.mjs';
import { walkRecording } from './shortWalkFixtures.mjs';

const { parsePoseRecording } = await loadTypeScript('src/domain/observations/poseRecording.ts');
const { analyzeTask } = await loadTypeScript('src/domain/observations/observationAnalysis.ts');
const { createObservationReport } = await loadTypeScript(
  'src/domain/observations/observationReport.ts',
);
const { parseObservationReport } = await loadTypeScript(
  'src/domain/observations/observationParser.ts',
);
const { extractMotionMetrics } = await loadTypeScript('src/domain/observations/motionMetrics.ts');
const { getAngleAnalysis } = await loadTypeScript('src/domain/observations/taskAnalysis.ts');

const patient = { id: 'p1', patientCode: 'PA-01', affectedSide: 'left', revision: 1 };

function splitRecording(recording, splitMs) {
  const original = recording.segments[0];
  assert.equal(recording.segments.length, 1);
  return {
    ...recording,
    segments: [
      {
        ...original,
        durationMs: splitMs,
        frames: original.frames.filter((frame) => frame.timestampMs < splitMs),
      },
      {
        ...original,
        segmentIndex: 1,
        startedAtMs: splitMs + 5000,
        durationMs: original.durationMs - splitMs,
        frames: original.frames
          .filter((frame) => frame.timestampMs >= splitMs)
          .map((frame) => ({ ...frame, timestampMs: frame.timestampMs - splitMs })),
      },
    ],
  };
}

test('新版原始采集往返保留坐标空间、置信度、图像变换和独立分段', () => {
  const pose = splitRecording(toCurrentRecording(walkRecording()), 2200);
  const snapshot = structuredClone(pose);
  assert.deepEqual(parsePoseRecording(pose), pose);
  const analysis = analyzeTask(pose, 'left', 'short_walk');
  assert.equal(analysis.commonMetrics.durationMs, pose.durationMs);
  assert.deepEqual(pose, snapshot);
  assert.equal(pose.segments[1].frames[0].timestampMs, 0);
  assert.deepEqual(Object.keys(pose.segments[0].frames[0]).sort(), ['landmarks', 'timestampMs']);
  assert.equal(pose.metadata.coordinateSystem.depth, 'mediapipe_relative_non_metric');
});

test('相邻片段时间只差100毫秒也不跨暂停识别坐站、踏步和步行周期', () => {
  for (const [taskId, legacy, splitMs] of [
    ['sit_to_stand', sitToStandRecording(), 1800],
    ['march_in_place', marchRecording(), 1100],
    ['short_walk', walkRecording(), 2200],
  ]) {
    const original = toCurrentRecording(legacy);
    const whole = analyzeTask(original, 'left', taskId, 'partial');
    const split = parsePoseRecording(splitRecording(original, splitMs));
    const result = analyzeTask(split, 'left', taskId, 'partial');
    assert.ok(result.commonMetrics.repetitions < whole.commonMetrics.repetitions, taskId);
    const report = createObservationReport(
      patient,
      {
        phase: 'finished',
        context: { patientId: patient.id, affectedSide: 'left', taskId },
      },
      split,
      'partial',
      false,
    );
    assert.deepEqual(parseObservationReport(report), report);
    const metrics = result.taskResult.metrics;
    const events = metrics.cycles ?? metrics.steps;
    for (const event of events) {
      assert.ok(event.endedAtMs < splitMs || event.startedAtMs >= splitMs);
    }
    const series = getAngleAnalysis(result).series;
    const boundary = series.findIndex((sample) => sample.segmentIndex === 1);
    assert.equal(series[boundary].timestampMs, splitMs);
    assert.notEqual(series[boundary - 1].segmentIndex, series[boundary].segmentIndex);
  }
});

test('原始数据边界拒绝错误拓扑、图像空间、片段重叠、重复时刻和派生字段', () => {
  const original = splitRecording(toCurrentRecording(walkRecording()), 2200);
  for (const change of [
    (pose) => {
      pose.metadata.landmarkOrder.reverse();
    },
    (pose) => {
      pose.metadata.coordinateSystem.origin = 'center';
    },
    (pose) => {
      pose.metadata.preprocessing.mirrored = true;
    },
    (pose) => {
      pose.segments[1].startedAtMs = 0;
    },
    (pose) => {
      pose.segments[1].segmentIndex = 0;
    },
    (pose) => {
      pose.segments[0].frames[1].timestampMs = 0;
    },
    (pose) => {
      pose.segments[0].frames[0].isInPreview = true;
    },
    (pose) => {
      pose.segments[0].imageDimensions.width++;
    },
    (pose) => {
      pose.segments[0].preprocessing.bufferToModelMatrix[0] = NaN;
    },
    (pose) => {
      pose.segments[0].preprocessing.bufferToModelMatrix[0] = 2;
    },
    (pose) => {
      pose.segments[0].frames[0].landmarks[0].z = Infinity;
    },
    (pose) => {
      delete pose.segments[0].frames[0].landmarks[0].z;
    },
    (pose) => {
      pose.segments[0].frames[0].angle = 90;
    },
    (pose) => {
      pose.durationMs++;
    },
    (pose) => {
      pose.segments[0].videoSegmentId = '../video.mp4';
    },
  ]) {
    const changed = structuredClone(original);
    change(changed);
    assert.throws(() => parsePoseRecording(changed));
  }
});

test('四个旋转方向保留非居中裁切和相对深度，公共空间变化时使用片段元信息', () => {
  for (const [rotation, matrix] of [
    [0, [1, 0, -80, 0, 1, -40, 0, 0, 1]],
    [90, [0, -1, 400, 1, 0, -80, 0, 0, 1]],
    [180, [-1, 0, 560, 0, -1, 400, 0, 0, 1]],
    [270, [0, 1, -40, -1, 0, 560, 0, 0, 1]],
  ]) {
    const pose = toCurrentRecording(walkRecording());
    const swaps = rotation === 90 || rotation === 270;
    const space = {
      imageDimensions: { width: swaps ? 360 : 480, height: swaps ? 480 : 360 },
      preprocessing: {
        imageSpace: 'cropped_upright_model_input',
        sourceImageDimensions: { width: 640, height: 480 },
        cropRect: { left: 80, top: 40, width: 480, height: 360 },
        rotationDegrees: rotation,
        mirrored: false,
        bufferToModelMatrix: matrix,
      },
    };
    Object.assign(pose.metadata, space);
    Object.assign(pose.segments[0], structuredClone(space));
    pose.segments[0].frames[0].landmarks[0].z = -0.25;
    assert.deepEqual(parsePoseRecording(pose), pose);
    const split = splitRecording(pose, 2200);
    split.metadata.imageDimensions = null;
    split.metadata.preprocessing = null;
    assert.deepEqual(parsePoseRecording(split), split);
  }
});

test('新版分析必须保留整数片段索引，质量字段不能混入任务专用结果', () => {
  const pose = splitRecording(toCurrentRecording(walkRecording()), 2200);
  const report = createObservationReport(
    patient,
    {
      phase: 'finished',
      context: { patientId: patient.id, affectedSide: 'left', taskId: 'short_walk' },
    },
    pose,
    'partial',
    false,
  );
  for (const value of [undefined, -1, 0.5, 9_000]) {
    const changed = structuredClone(report);
    changed.taskAnalysis.taskResult.angle.series[0].segmentIndex = value;
    assert.throws(() => parseObservationReport(changed));
  }
  const changed = structuredClone(report);
  changed.taskAnalysis.taskResult.angle.captureQuality = 'valid';
  assert.throws(() => parseObservationReport(changed));
});

test('统一指标从任务分析提取，保留真实零值、缺失原因和带方向的左右差', () => {
  const pose = toCurrentRecording(marchRecording(Array(48).fill({})));
  const analysis = analyzeTask(pose, 'left', 'march_in_place', 'completed');
  const metrics = extractMotionMetrics(analysis);
  const steps = metrics.find((item) => item.definition.key === 'left_steps');
  const duration = metrics.find((item) => item.definition.key === 'mean_step_duration');
  assert.equal(steps.metric.value, 0);
  assert.equal(steps.metric.availability, 'available');
  assert.equal(duration.metric.value, null);
  assert.equal(duration.metric.unavailableReason, 'no_complete_cycle');
  const invalid = extractMotionMetrics(
    analyzeTask({ ...pose, isTruncated: true }, 'left', 'march_in_place', 'completed'),
  );
  assert.equal(invalid[0].metric.unavailableReason, 'invalid_capture');
  assert.equal(
    invalid.find((item) => item.definition.key === 'active_duration').metric.value,
    pose.durationMs,
  );
});

test('四状态之外拒绝创建报告；旧安全停止只读且不改变历史语义', () => {
  const pose = toCurrentRecording(walkRecording());
  const session = {
    phase: 'finished',
    context: { patientId: patient.id, affectedSide: 'left', taskId: 'short_walk' },
  };
  for (const status of ['not_attempted', 'not_applicable', 'stopped_safety']) {
    assert.throws(() => createObservationReport(patient, session, pose, status, false));
  }
  const report = createObservationReport(patient, session, pose, 'partial', false);
  const { taskAnalysis, ...fields } = report;
  const old = {
    ...fields,
    schemaVersion: 1,
    taskStatus: 'stopped_safety',
    safetyStopReason: 'pain',
    analysis: getAngleAnalysis(taskAnalysis),
  };
  const restored = parseObservationReport(old);
  assert.equal(restored.sourceSchemaVersion, 1);
  assert.equal(restored.taskStatus, 'stopped_safety');
  assert.equal(restored.legacySafetyStopReason, 'pain');
  assert.equal(restored.taskAnalysis.taskStatus, null);
  assert.throws(() => parseObservationReport({ ...report, taskStatus: 'stopped_safety' }));
});
