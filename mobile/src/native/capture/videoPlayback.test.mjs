import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const { createVideoPlayback, reduceVideoPlayback, formatVideoTime } = await loadTypeScript(
  'src/native/capture/videoPlayback.ts',
);
const initial = () => createVideoPlayback([10_000, 20_000]);
const status = (state, name, positionMs = 0, seekRequestId = state.seekRequestId) =>
  reduceVideoPlayback(state, {
    type: 'status',
    generation: state.generation,
    value: { status: name, positionMs, durationMs: state.durationMs, seekRequestId },
  });
const ready = () => status(initial(), 'paused');
const playing = () => reduceVideoPlayback(ready(), { type: 'toggle' });

test('读取首帧不自动播放，最后一段结束后可重播', () => {
  let state = ready();
  assert.equal(state.isPlaying, false);
  state = reduceVideoPlayback(state, { type: 'select', index: 1 });
  state = status(state, 'paused');
  state = reduceVideoPlayback(state, { type: 'toggle' });
  state = status(state, 'ended', 20_000);
  assert.equal(state.isPlaying, false);
  state = reduceVideoPlayback(state, { type: 'toggle' });
  assert.equal(state.isPlaying, true);
  assert.equal(state.seekPositionMs, 0);
  assert.equal(state.isSeeking, true);
});

test('播放结束自动接播，暂停和后台后的迟到结束事件不接播', () => {
  const next = status(playing(), 'ended', 10_000);
  assert.equal(next.segmentIndex, 1);
  assert.equal(next.isPlaying, true);
  assert.equal(next.status, 'loading');
  assert.equal(next.positionMs, 0);
  assert.equal(next.durationMs, 20_000);
  for (const type of ['toggle', 'inactive']) {
    const paused = reduceVideoPlayback(playing(), { type });
    const ended = status(paused, 'ended', 10_000);
    assert.equal(ended.segmentIndex, 0);
    assert.equal(ended.isPlaying, false);
  }
});

test('拖动时暂停并保留目标，定位完成后才接收进度和恢复播放', () => {
  let state = reduceVideoPlayback(playing(), { type: 'scrub', positionMs: 5000 });
  assert.equal(state.isPlaying, false);
  assert.equal(state.scrub.shouldResume, true);
  assert.equal(status(state, 'playing', 2000), state);
  state = reduceVideoPlayback(state, { type: 'scrub', positionMs: 7000 });
  state = reduceVideoPlayback(state, { type: 'seek', positionMs: 7000 });
  assert.equal(state.isPlaying, true);
  assert.equal(state.isSeeking, true);
  assert.equal(state.seekRequestId, 1);
  assert.equal(status(state, 'ended', 10_000, 0), state);
  assert.equal(status(state, 'paused', 2000, 0), state);
  state = status(state, 'playing', 7000, 1);
  assert.equal(state.isSeeking, false);
  assert.equal(state.positionMs, 7000);
  const paused = reduceVideoPlayback(ready(), { type: 'seek', positionMs: 5000 });
  assert.equal(paused.isPlaying, false);
});

test('快速切段忽略旧事件，越界选择不改变当前片段', () => {
  const state = reduceVideoPlayback(playing(), { type: 'select', index: 1 });
  assert.equal(state.isPlaying, true);
  assert.equal(
    reduceVideoPlayback(state, {
      type: 'status',
      generation: 0,
      value: { status: 'ended', positionMs: 10_000, durationMs: 10_000, seekRequestId: 0 },
    }),
    state,
  );
  for (const index of [-1, 2, Infinity, 0.5]) {
    assert.equal(reduceVideoPlayback(state, { type: 'select', index }), state);
  }
});

test('错误可重试，重试不自动播放，非法原生数据不破坏状态', () => {
  const failed = status(playing(), 'error');
  assert.equal(failed.isPlaying, false);
  const retry = reduceVideoPlayback(failed, { type: 'retry' });
  assert.equal(retry.status, 'loading');
  assert.equal(retry.generation, 1);
  assert.equal(retry.isPlaying, false);
  for (const value of [
    null,
    { status: 'unknown', positionMs: 0, durationMs: 100, seekRequestId: 0 },
    { status: 'playing', positionMs: Infinity, durationMs: 100, seekRequestId: 0 },
    { status: 'playing', positionMs: -1, durationMs: 100, seekRequestId: 0 },
    { status: 'playing', positionMs: 1, durationMs: 100, seekRequestId: -1 },
  ]) {
    assert.equal(reduceVideoPlayback(retry, { type: 'status', generation: 1, value }), retry);
  }
});

test('离开页面清除拖动恢复意图，定位和时长显示处理边界', () => {
  let state = reduceVideoPlayback(playing(), { type: 'scrub', positionMs: 8000 });
  state = reduceVideoPlayback(state, { type: 'inactive' });
  assert.equal(state.scrub, null);
  assert.equal(state.isPlaying, false);
  assert.equal(
    reduceVideoPlayback(ready(), { type: 'seek', positionMs: Infinity }).seekRequestId,
    0,
  );
  assert.equal(
    reduceVideoPlayback(ready(), { type: 'seek', positionMs: 20_000 }).seekPositionMs,
    9999,
  );
  assert.equal(reduceVideoPlayback(ready(), { type: 'seek', positionMs: -100 }).seekPositionMs, 0);
  assert.equal(formatVideoTime(0), '00:00');
  assert.equal(formatVideoTime(3_661_999), '61:01');
});
