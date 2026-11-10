import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';
import { toCurrentRecording } from './recordingFixtures.mjs';
import { walkRecording } from './shortWalkFixtures.mjs';

const { createCaptureSession } = await loadTypeScript('src/domain/capture/captureSession.ts');
const { createObservationReport } = await loadTypeScript(
  'src/domain/observations/observationReport.ts',
);
const { parseObservationReport } = await loadTypeScript(
  'src/domain/observations/observationParser.ts',
);
const { getComparisonIssues } = await loadTypeScript(
  'src/domain/observations/observationHistory.ts',
);
const { rehabTasks } = await loadTypeScript('src/domain/tasks/taskCatalog.ts');

const patient = { id: 'p1', patientCode: 'PA-01', affectedSide: 'left', revision: 1 };
const context = { patientId: 'p1', affectedSide: 'left', taskId: 'short_walk' };
const pose = toCurrentRecording(walkRecording());
const session = { ...createCaptureSession(context), phase: 'finished' };
const create = (status = 'completed', assisted = false, recording = pose) =>
  createObservationReport(patient, session, recording, status, assisted);

test('七项任务按左右侧生成完整协议，暂停和结束保持同一次指导', () => {
  for (const task of rehabTasks) {
    for (const side of ['left', 'right']) {
      const capture = createCaptureSession({ ...context, taskId: task.id, affectedSide: side });
      const protocol = capture.taskProtocol;
      assert.equal(protocol.taskType, task.id);
      assert.equal(protocol.category, 'free_observation');
      for (const field of [
        'movementInstructions',
        'cameraRequirements',
        'assistanceRules',
        'compensationRules',
      ]) {
        assert.ok(protocol[field].length > 0);
      }
      const saved = createObservationReport(
        { ...patient, affectedSide: side },
        { ...capture, phase: 'finished' },
        pose,
        'partial',
        true,
      );
      assert.deepEqual(parseObservationReport(saved), saved);
    }
  }
});

test('完成情况、辅助和采集质量互相独立，旧辅助入参归一为完成', () => {
  for (const status of ['completed', 'partial', 'unable']) {
    for (const assisted of [false, true]) {
      const report = create(status, assisted);
      assert.equal(report.taskStatus, status);
      assert.equal(report.assistance, assisted ? 'manual_or_device' : 'none');
      assert.deepEqual(parseObservationReport(report), report);
    }
  }
  const invalid = create('completed', true, { ...pose, isTruncated: true });
  assert.equal(invalid.taskStatus, 'completed');
  assert.equal(invalid.captureQuality, 'invalid_capture');
  assert.equal(invalid.repetitions, null);
  assert.equal(create('assisted', true).taskStatus, 'completed');
  assert.throws(() => create('assisted', false));
});

test('保存当次指导和指标定义快照，回读不以当前指导覆盖历史', () => {
  const report = create();
  assert.equal(report.schemaVersion, 3);
  assert.equal(report.measurementContext.validationStatus, 'engineering_unvalidated');
  assert.notEqual(report.measurementContext.taskProtocol, session.taskProtocol);
  assert.notEqual(
    report.measurementContext.taskProtocol.movementInstructions,
    session.taskProtocol.movementInstructions,
  );
  const saved = structuredClone(report);
  saved.measurementContext.taskProtocol.protocolVersion = 'previous-version';
  saved.measurementContext.taskProtocol.startPosition = '当时的起始姿势';
  assert.deepEqual(parseObservationReport(saved), saved);
  for (const mutate of [
    (value) => {
      delete value.measurementContext;
    },
    (value) => {
      value.measurementContext.taskProtocol.taskType = 'sit_to_stand';
    },
    (value) => {
      value.measurementContext.metricDefinitions[0].unit = 'count';
    },
    (value) => {
      value.measurementContext.metricDefinitions.pop();
    },
    (value) => {
      value.measurementContext.metricDefinitionVersion = 2;
    },
    (value) => {
      value.measurementContext.validationStatus = 'clinically_validated';
    },
  ]) {
    const changed = structuredClone(report);
    mutate(changed);
    assert.throws(() => parseObservationReport(changed));
  }
});

test('旧版报告保持缺少快照的事实，禁止与新协议直接对比', () => {
  const report = create();
  const previous = { ...report, schemaVersion: 2 };
  delete previous.measurementContext;
  const restored = parseObservationReport(previous);
  assert.equal(restored.schemaVersion, 2);
  assert.equal(restored.measurementContext, undefined);
  const assistedLegacy = {
    ...previous,
    taskStatus: 'assisted',
    assistance: 'manual_or_device',
    taskAnalysis: { ...previous.taskAnalysis, taskStatus: 'assisted' },
  };
  assert.equal(parseObservationReport(assistedLegacy).taskStatus, 'assisted');
  const other = { ...report, id: 'other' };
  assert.ok(getComparisonIssues(restored, other).some((issue) => issue.includes('旧记录缺少')));
  assert.deepEqual(getComparisonIssues(report, other), []);
  for (const mutate of [
    (value) => {
      value.measurementContext.taskProtocol.protocolVersion = '2';
    },
    (value) => {
      value.measurementContext.taskProtocol.startPosition = '不同条件';
    },
    (value) => {
      value.measurementContext.metricDefinitions[0].definition = '不同指标含义';
    },
  ]) {
    const changed = structuredClone(other);
    mutate(changed);
    assert.ok(getComparisonIssues(report, changed).length > 0);
  }
});
