import { initialPoseCameraState } from './poseCamera';
import type { PoseCameraState } from './poseCamera';

export interface PoseCameraStream {
  readonly camera: PoseCameraState;
  readonly latestFrameTimestampMs: number | null;
  readonly lastProgressAtMs: number | null;
}

export const initialPoseCameraStream: PoseCameraStream = {
  camera: initialPoseCameraState,
  latestFrameTimestampMs: null,
  lastProgressAtMs: null,
};

export function receivePoseCameraState(
  stream: PoseCameraStream,
  camera: PoseCameraState,
  receivedAtMs: number,
): PoseCameraStream {
  if (camera.status !== 'ready' || camera.frameTimestampMs === null) {
    return { ...stream, camera: { ...camera, hasRequiredLandmarks: false } };
  }
  // 重复或倒退的帧不能延长清晰提示；重开预览时单独清空时间基线。
  if (
    stream.latestFrameTimestampMs !== null &&
    camera.frameTimestampMs <= stream.latestFrameTimestampMs
  ) {
    return stream;
  }
  return {
    camera,
    latestFrameTimestampMs: camera.frameTimestampMs,
    lastProgressAtMs: receivedAtMs,
  };
}

export function expirePoseCameraStream(stream: PoseCameraStream, nowMs: number): PoseCameraStream {
  if (
    stream.camera.status !== 'ready' ||
    stream.camera.code === 'summary_stale' ||
    stream.lastProgressAtMs === null ||
    nowMs - stream.lastProgressAtMs <= 1_500
  ) {
    return stream;
  }
  return {
    ...stream,
    camera: { ...stream.camera, code: 'summary_stale', hasRequiredLandmarks: false },
  };
}
