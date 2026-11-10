import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const { parseAppPreferences, defaultAppPreferences } = await loadTypeScript(
  'src/domain/settings/appPreferences.ts',
);
const { parseLocalDataStats, parseDeletionPreview } = await loadTypeScript(
  'src/domain/storage/localData.ts',
);

test('采集偏好只接受明确布尔值，保留 false 并拒绝缺字段和伪布尔值', () => {
  assert.deepEqual(parseAppPreferences(defaultAppPreferences), defaultAppPreferences);
  const values = { showSkeleton: false, showCaptureHints: false, defaultAssistance: true };
  assert.deepEqual(parseAppPreferences(values), { ...values, poseModel: 'lite' });
  for (const bad of [
    null,
    [],
    {},
    { ...values, showSkeleton: 0 },
    { ...values, showCaptureHints: 'false' },
  ]) {
    assert.throws(() => parseAppPreferences(bad));
  }
});

test('三档模型偏好准确回读，旧设置迁移为 Lite，拒绝未知型号', () => {
  for (const poseModel of ['lite', 'full', 'heavy']) {
    const preferences = { ...defaultAppPreferences, poseModel };
    assert.deepEqual(parseAppPreferences(preferences), preferences);
  }
  for (const poseModel of [null, '', 'Full', 'other', 1, true]) {
    assert.throws(() => parseAppPreferences({ ...defaultAppPreferences, poseModel }));
  }
});

test('本地统计拒绝负数、分数和缺失，删除凭据必须完整', () => {
  const stats = {
    patients: 0,
    assessments: 0,
    observations: 0,
    databaseBytes: 1024,
    poseBytes: 0,
    videoBytes: 0,
    photoBytes: 0,
    orphanFiles: 0,
  };
  assert.deepEqual(parseLocalDataStats(stats), stats);
  const { videoBytes: _videoBytes, photoBytes: _photoBytes, ...legacy } = stats;
  assert.deepEqual(parseLocalDataStats(legacy), stats);
  for (const value of [-1, 1.5, NaN, Infinity, '1', null]) {
    assert.throws(() => parseLocalDataStats({ ...stats, patients: value }));
    assert.throws(() => parseLocalDataStats({ ...stats, videoBytes: value }));
    assert.throws(() => parseLocalDataStats({ ...stats, photoBytes: value }));
  }
  const preview = { token: 'a'.repeat(64), patients: 0, assessments: 0, observations: 1 };
  assert.deepEqual(parseDeletionPreview(preview), preview);
  for (const token of ['', 'a'.repeat(63), 'z'.repeat(64)]) {
    assert.throws(() => parseDeletionPreview({ ...preview, token }));
  }
});
