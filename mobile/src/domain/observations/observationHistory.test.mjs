import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const {
  validateHistoryDates,
  filterObservationHistory,
  getComparisonIssues,
  getObservationChanges,
} = await loadTypeScript('src/domain/observations/observationHistory.ts');
const filter = {
  patientId: null,
  taskId: null,
  quality: null,
  status: null,
  side: null,
  from: '',
  through: '',
};
const earlier = {
  id: 'early',
  patientId: 'patient-1',
  taskId: 'elbow_flexion_extension',
  affectedSide: 'left',
  observedAt: new Date(2026, 10, 8, 23, 59, 59).toISOString(),
  cameraView: 'side',
  assistance: 'none',
  protocolVersion: 'elbow-side-v1',
  analysisVersion: 'elbow-2d-v1',
  modelVersion: 'lite-v1',
  captureQuality: 'valid',
  taskStatus: 'completed',
  repetitions: 0,
  durationMs: 4000,
  analysis: { rangeOfMotion: 0, minAngle: 150, maxAngle: 150 },
};
const later = {
  ...earlier,
  id: 'late',
  observedAt: new Date(2026, 10, 9, 0, 0, 0).toISOString(),
  repetitions: 1,
  durationMs: 5000,
  analysis: { rangeOfMotion: 20, minAngle: 130, maxAngle: 150 },
};

test('历史日期检查真实日历、闰年、区间顺序和单边界', () => {
  for (const value of ['2026-02-29', '2026-13-01', '2026-11-31', '2026-1-01', 'abc']) {
    assert.ok(validateHistoryDates(value, ''));
  }
  assert.equal(validateHistoryDates('2024-02-29', ''), null);
  assert.equal(validateHistoryDates('', '2026-11-09'), null);
  assert.ok(validateHistoryDates('2026-11-10', '2026-11-09'));
});

test('日期按本地日历包含结束当天，按时间排序且不修改原列表', () => {
  const list = [earlier, later];
  assert.deepEqual(
    filterObservationHistory(list, filter).map((row) => row.id),
    ['late', 'early'],
  );
  assert.equal(list[0].id, 'early');
  assert.deepEqual(
    filterObservationHistory(list, { ...filter, from: '2026-11-08', through: '2026-11-08' }),
    [earlier],
  );
  assert.deepEqual(filterObservationHistory(list, { ...filter, from: 'bad' }), []);
});

test('运行环境缺少 toSorted 时，空历史和已有记录仍可筛选排序', () => {
  // 在隔离环境中模拟手机数组，不改动测试进程的内置对象。
  const createLegacyArray = runInNewContext(`
    delete Array.prototype.toSorted;
    (...items) => items;
  `);
  const records = Object.freeze(createLegacyArray(earlier, later));
  assert.equal(typeof records.toSorted, 'undefined');
  assert.deepEqual(Array.from(filterObservationHistory(createLegacyArray(), filter)), []);
  assert.deepEqual(
    Array.from(filterObservationHistory(records, filter), (row) => row.id),
    ['late', 'early'],
  );
  assert.equal(records[0].id, 'early');
  assert.deepEqual(
    Array.from(filterObservationHistory(records, { ...filter, from: '2026-11-09' })),
    [later],
  );
});

test('患者、任务、质量、任务状态和患侧共同筛选', () => {
  const list = [
    earlier,
    {
      ...later,
      patientId: 'patient-2',
      affectedSide: 'right',
      captureQuality: 'degraded',
      taskStatus: 'partial',
    },
  ];
  for (const selection of [
    { patientId: 'patient-2' },
    { quality: 'degraded' },
    { status: 'partial' },
    { side: 'right' },
  ])
    assert.deepEqual(
      filterObservationHistory(list, { ...filter, ...selection }).map((row) => row.id),
      ['late'],
    );
  assert.deepEqual(filterObservationHistory(list, { ...filter, taskId: 'shoulder_flexion' }), []);
  assert.deepEqual(
    filterObservationHistory(list, { ...filter, patientId: 'patient-2', side: 'left' }),
    [],
  );
});

test('对比拒绝每一项协议不一致、低质量、安全停止和同条记录', () => {
  assert.deepEqual(getComparisonIssues(earlier, later), []);
  for (const [key, value] of Object.entries({
    id: earlier.id,
    patientId: 'other',
    taskId: 'shoulder_flexion',
    affectedSide: 'right',
    cameraView: 'front',
    assistance: 'manual_or_device',
    protocolVersion: 'v2',
    analysisVersion: 'v2',
    modelVersion: 'v2',
    captureQuality: 'degraded',
    taskStatus: 'stopped_safety',
  })) {
    const result = getObservationChanges(earlier, { ...later, [key]: value });
    assert.ok(result.issues.length > 0, key);
    assert.deepEqual(result.metrics, []);
  }
  assert.ok(getComparisonIssues({ ...earlier, captureQuality: 'invalid_capture' }, later).length);
  assert.ok(getComparisonIssues({ ...earlier, taskStatus: 'stopped_safety' }, later).length);
});

test('对比固定较晚减较早，真实零值保留，缺失值不产生假差值', () => {
  const changes = getObservationChanges(later, earlier);
  assert.equal(changes.earlier.id, 'early');
  assert.equal(changes.later.id, 'late');
  assert.deepEqual(
    changes.metrics.map((row) => row.change),
    [20, -20, 0, 1, 1],
  );
  const missing = getObservationChanges(earlier, {
    ...later,
    repetitions: null,
    analysis: { ...later.analysis, rangeOfMotion: null },
  });
  assert.equal(missing.metrics[0].change, null);
  assert.equal(missing.metrics[3].change, null);
});
