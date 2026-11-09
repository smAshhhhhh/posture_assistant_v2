import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../../scripts/loadTypeScript.mjs';

const { createCameraStartup } = await loadTypeScript('src/features/capture/model/cameraStartup.ts');
const { initialPoseCameraState } = await loadTypeScript('src/domain/capture/poseCamera.ts');

test('恢复只等待设备就绪，无人体或关键点不足也允许继续', async () => {
  for (const landmarkCount of [0, 33]) {
    const startup = createCameraStartup();
    const ready = startup.wait();
    startup.update({ ...initialPoseCameraState, status: 'starting' });
    startup.update({
      ...initialPoseCameraState,
      status: 'ready',
      hasRequiredLandmarks: false,
      landmarkCount,
    });
    assert.equal(await ready, true);
  }
});

test('设备失败或进入后台会终止本次恢复，迟到就绪不能反转结果', async () => {
  for (const status of ['error', 'background', 'interrupted']) {
    const startup = createCameraStartup();
    const ready = startup.wait();
    startup.update({ ...initialPoseCameraState, status });
    startup.update({ ...initialPoseCameraState, status: 'ready' });
    assert.equal(await ready, false);
  }
});

test('结束观察或离开页面取消等待，后续可以重新发起恢复', async () => {
  const startup = createCameraStartup();
  const cancelled = startup.wait();
  startup.cancel();
  startup.cancel();
  startup.update({ ...initialPoseCameraState, status: 'ready' });
  assert.equal(await cancelled, false);
  const retry = startup.wait();
  startup.update({ ...initialPoseCameraState, status: 'ready' });
  assert.equal(await retry, true);
});

test('连续等待会取消旧请求，设备无响应到时返回失败', async () => {
  const startup = createCameraStartup();
  const first = startup.wait();
  const second = startup.wait(10);
  assert.equal(await first, false);
  assert.equal(await second, false);
});
