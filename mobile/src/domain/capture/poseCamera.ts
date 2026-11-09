import type { PoseRecording } from '../observations/poseRecording';

export type PoseCameraStatus =
  'starting' | 'ready' | 'stopped' | 'background' | 'interrupted' | 'error';

export interface PoseCameraState {
  readonly status: PoseCameraStatus;
  readonly code: string;
  readonly hasRequiredLandmarks: boolean;
  readonly landmarkCount: number | null;
  readonly inferenceMs: number | null;
  readonly frameTimestampMs: number | null;
}

export interface PoseCameraPreviewProps {
  readonly active: boolean;
  readonly showSkeleton: boolean;
  readonly requiredLandmarks: readonly number[];
  readonly onStatus: (state: PoseCameraState) => void;
}

export interface PoseCameraGateway {
  readonly isAvailable: boolean;
  readonly canRecord?: boolean;
  readonly canRecordVideo?: boolean;
  beginRecording?(resume: boolean): Promise<void>;
  finishRecording?(): Promise<PoseRecording>;
  discardVideo?(id: string): Promise<void>;
  discardRecording?(): Promise<void>;
  stop(): Promise<void>;
}

export const initialPoseCameraState: PoseCameraState = {
  status: 'stopped',
  code: 'none',
  hasRequiredLandmarks: false,
  landmarkCount: null,
  inferenceMs: null,
  frameTimestampMs: null,
};

export function parsePoseCameraState(value: unknown): PoseCameraState | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('status' in value) || !('code' in value)) return null;
  const { status, code } = value;
  if (
    status !== 'starting' &&
    status !== 'ready' &&
    status !== 'stopped' &&
    status !== 'background' &&
    status !== 'interrupted' &&
    status !== 'error'
  )
    return null;
  if (typeof code !== 'string') return null;
  const readNumber = (key: string): number | null => {
    if (!(key in value)) return null;
    const candidate: unknown = Reflect.get(value, key);
    return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0
      ? candidate
      : null;
  };
  const landmarkCount = readNumber('landmarkCount');
  if (landmarkCount !== null && (!Number.isInteger(landmarkCount) || landmarkCount > 33)) {
    return null;
  }
  const frameTimestampMs = readNumber('frameTimestampMs');
  const hasRequiredLandmarks =
    status === 'ready' &&
    code === 'none' &&
    landmarkCount === 33 &&
    frameTimestampMs !== null &&
    'hasRequiredLandmarks' in value &&
    value.hasRequiredLandmarks === true;

  return {
    status,
    code,
    hasRequiredLandmarks,
    landmarkCount,
    inferenceMs: readNumber('inferenceMs'),
    frameTimestampMs,
  };
}
