import type { PoseCameraState } from '../../../domain/capture/poseCamera';

interface PendingStartup {
  readonly resolve: (isReady: boolean) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

export function createCameraStartup() {
  let pending: PendingStartup | null = null;
  const complete = (isReady: boolean) => {
    const current = pending;
    if (!current) return;
    pending = null;
    clearTimeout(current.timeout);
    current.resolve(isReady);
  };

  return {
    wait(timeoutMs = 15_000): Promise<boolean> {
      complete(false);
      return new Promise((resolve) => {
        pending = { resolve, timeout: setTimeout(() => complete(false), timeoutMs) };
      });
    },
    update(state: PoseCameraState) {
      // 只等待设备就绪，不检查人体、关节或识别质量。
      if (state.status === 'ready') complete(true);
      else if (
        state.status === 'error' ||
        state.status === 'background' ||
        state.status === 'interrupted'
      ) {
        complete(false);
      }
    },
    cancel: () => complete(false),
  };
}
