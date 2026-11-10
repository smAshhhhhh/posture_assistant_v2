import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const { parsePoseRecording } = await loadTypeScript(
  'src/domain/observations/legacyPoseRecording.ts',
);
const { parseObservationVideo } = await loadTypeScript(
  'src/domain/observations/observationVideo.ts',
);
const id = '12345678-1234-4234-8234-123456789abc';
const pose = {
  schemaVersion: 1,
  id,
  observedAt: '2026-11-09T10:00:00.000Z',
  modelVersion: 'pose/v1',
  durationMs: 3000,
  isTruncated: false,
  frames: [],
};
const segment = { fileName: `${id}-0.mp4`, durationMs: 2000 };

test('旧关键点数据保持兼容，录像片段及中断状态可往返传递', () => {
  assert.deepEqual(parsePoseRecording(pose), pose);
  const recording = { ...pose, video: { segments: [segment], error: 'recording_failed' } };
  assert.deepEqual(parsePoseRecording(recording), recording);
  assert.deepEqual(parsePoseRecording({ ...pose, video: { segments: [], error: null } }).video, {
    segments: [],
    error: null,
  });
});

test('录像不允许跨会话、乱序、目录穿越和无效时长', () => {
  for (const invalid of [
    { ...segment, fileName: '../outside.mp4' },
    { ...segment, fileName: `${id}-1.mp4` },
    { ...segment, fileName: `22345678-1234-4234-8234-123456789abc-0.mp4` },
    { ...segment, durationMs: 0 },
    { ...segment, durationMs: Infinity },
  ]) {
    assert.throws(() =>
      parsePoseRecording({ ...pose, video: { segments: [invalid], error: null } }),
    );
  }
  assert.throws(() =>
    parsePoseRecording({ ...pose, video: { segments: [segment], error: 'unknown' } }),
  );
});

test('回放仅接受本地视频；旧记录和中断片段明确区分', () => {
  assert.equal(parseObservationVideo(null), null);
  for (const uri of [
    'file:///data/user/0/app/files/video.mp4',
    'file:/data/user/0/app/files/video.mp4',
  ]) {
    const video = { bytes: 100, isPartial: true, segments: [{ uri, durationMs: 2000 }] };
    assert.deepEqual(parseObservationVideo(video), video);
  }
  for (const uri of [
    'https://example.com/video.mp4',
    'content://other/video.mp4',
    '../video.mp4',
  ]) {
    assert.throws(() =>
      parseObservationVideo({
        bytes: 100,
        isPartial: false,
        segments: [{ uri, durationMs: 2000 }],
      }),
    );
  }
  assert.throws(() => parseObservationVideo({ bytes: 0, isPartial: false, segments: [] }));
});
