import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

import { marchMotion, marchRecording } from './marchInPlaceFixtures.mjs';
import { sitToStandRecording } from './sitToStandFixtures.mjs';
import { walkMotion, walkRecording } from './shortWalkFixtures.mjs';

const { getObservationFeedback } = await loadTypeScript(
  'src/domain/observations/observationFeedback.ts',
);
const { analyzeObservation } = await loadTypeScript(
  'src/domain/observations/observationAnalysis.ts',
);
const { rehabTasks } = await loadTypeScript('src/domain/tasks/taskCatalog.ts');

test('七任务无效数据只提示缺失，不能生成零周期或临床推断', () => {
  for (const task of rehabTasks) {
    const analysis = analyzeObservation({ ...marchRecording(), frames: [] }, 'left', task.id);
    const feedback = getObservationFeedback(task.id, analysis, 'completed');
    assert.deepEqual(
      feedback.map((item) => item.code),
      ['invalid_capture'],
    );
    assert.equal(analysis.repetitions, null);
    assert.match(feedback[0].message, /不代表患者无法完成/);
    assert.equal(feedback[0].category, 'capture');
    assert.equal(feedback[0].severity, 'danger');
  }
});

test('清晰静止的四种关节任务保留零值，动作提示不将零值解释为无法完成', () => {
  const recording = marchRecording(Array.from({ length: 50 }, () => ({})));
  const landmarks = recording.frames[0].landmarks.map((point) => ({ ...point }));
  for (const offset of [0, 1]) {
    const x = 0.4 + offset * 0.04;
    for (const [index, dx, y] of [
      [11, 0, 0.2],
      [13, 0.1, 0.4],
      [15, 0.2, 0.6],
      [23, 0, 0.5],
      [25, 0.2, 0.5],
      [27, 0.2, 0.8],
    ]) {
      landmarks[index + offset] = { x: x + dx, y, presence: 1, visibility: 1 };
    }
  }
  recording.frames = recording.frames.map((frame) => ({ ...frame, landmarks }));
  for (const taskId of [
    'shoulder_flexion',
    'elbow_flexion_extension',
    'seated_trunk_lean',
    'seated_knee_extension',
  ]) {
    for (const side of ['left', 'right']) {
      const analysis = analyzeObservation(recording, side, taskId);
      assert.equal(analysis.captureQuality, 'valid');
      assert.equal(analysis.repetitions, 0);
      assert.equal(analysis.rangeOfMotion, 0);
      const feedback = getObservationFeedback(taskId, analysis, 'completed');
      assert.deepEqual(
        feedback.map((item) => item.code),
        ['no_complete_cycle'],
      );
      assert.match(feedback[0].message, /零次不代表患者无法完成/);
      assert.equal(feedback[0].category, 'movement');
      assert.equal(feedback[0].severity, 'warning');
    }
  }
});

test('踏步连续同侧建议来自实际序列，正常交替不显示此建议', () => {
  for (const side of ['left', 'right']) {
    const repeated = analyzeObservation(
      marchRecording(marchMotion([side, side, side])),
      side,
      'march_in_place',
    );
    assert.equal(repeated.marchInPlace.alternationErrors, 2);
    const feedback = getObservationFeedback('march_in_place', repeated, 'assisted');
    const hint = feedback.find((item) => item.code === 'same_side_steps');
    assert.equal(hint?.category, 'stepping');
    assert.equal(hint?.severity, 'warning');
    assert.match(hint?.message ?? '', /回放/);
    assert.doesNotMatch(hint?.message ?? '', /\d|次连续同侧/);
    const alternating = analyzeObservation(marchRecording(), side, 'march_in_place');
    assert.equal(
      getObservationFeedback('march_in_place', alternating, 'completed').some(
        (item) => item.code === 'same_side_steps',
      ),
      false,
    );
  }
});

test('步行单侧周期按双侧证据提示，平均耗时缺失不补零', () => {
  for (const side of ['left', 'right']) {
    const opposite = side === 'left' ? 'right' : 'left';
    const motion = walkMotion().map((angles) => ({ ...angles, [opposite]: 170 }));
    const analysis = analyzeObservation(walkRecording(motion), side, 'short_walk');
    assert.ok(analysis.repetitions > 0);
    const feedback = getObservationFeedback('short_walk', analysis, 'completed');
    assert.ok(feedback.some((item) => item.code === 'one_side_cycles'));
    const hint = feedback.find((item) => item.code === 'one_side_cycles');
    assert.equal(hint?.category, 'walking');
    assert.match(hint?.message ?? '', /双腿.*入镜/);
    assert.doesNotMatch(hint?.message ?? '', /平均耗时|左右对称性/);
    const key = opposite === 'left' ? 'meanLeftCycleDurationMs' : 'meanRightCycleDurationMs';
    assert.equal(analysis.shortWalk[key], null);
  }
});

test('清晰坐站、踏步和步行只建议结合回放，不给出异常阈值或完成判断', () => {
  const cases = [
    ['sit_to_stand', sitToStandRecording()],
    ['march_in_place', marchRecording()],
    ['short_walk', walkRecording()],
  ];
  for (const [taskId, recording] of cases) {
    const analysis = analyzeObservation(recording, 'left', taskId);
    const snapshot = structuredClone(analysis);
    assert.ok(analysis.repetitions > 0);
    const feedback = getObservationFeedback(taskId, analysis, null);
    assert.deepEqual(
      feedback.map((item) => item.code),
      ['review_video'],
    );
    assert.deepEqual(analysis, snapshot);
    assert.equal(feedback[0].category, 'movement');
    assert.equal(feedback[0].severity, 'info');
    assert.doesNotMatch(feedback[0].message, /关节.*可用/);
  }
});

test('真实采样间断给出质量提示，安全停止始终排在第一条', () => {
  const recording = sitToStandRecording();
  recording.frames = recording.frames.filter(
    (frame) => frame.timestampMs < 900 || frame.timestampMs > 1_800,
  );
  const analysis = analyzeObservation(recording, 'left', 'sit_to_stand');
  assert.equal(analysis.captureQuality, 'degraded');
  const feedback = getObservationFeedback('sit_to_stand', analysis, 'stopped_safety');
  assert.equal(feedback[0].code, 'stopped_safety');
  assert.equal(feedback[0].category, 'completion');
  assert.equal(feedback[0].severity, 'danger');
  assert.ok(feedback.some((item) => item.code === 'degraded'));
  const qualityHint = feedback.find((item) => item.code === 'degraded');
  assert.equal(qualityHint?.category, 'capture');
  assert.equal(qualityHint?.severity, 'warning');
  assert.match(qualityHint?.message ?? '', /复核是否漏计/);
  assert.doesNotMatch(qualityHint?.message ?? '', /\d|占比|最长数据间断|有效样本/);
  const invalid = analyzeObservation({ ...recording, frames: [] }, 'left', 'sit_to_stand');
  assert.deepEqual(
    getObservationFeedback('sit_to_stand', invalid, 'stopped_safety').map((item) => item.code),
    ['stopped_safety', 'invalid_capture'],
  );
});
