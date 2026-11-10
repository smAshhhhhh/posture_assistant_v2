import { readObject } from '../observations/poseRecording';
import { isPoseModelId } from '../capture/poseModel';
import type { PoseModelId } from '../capture/poseModel';

export interface AppPreferences {
  readonly showSkeleton: boolean;
  readonly showCaptureHints: boolean;
  readonly defaultAssistance: boolean;
  readonly poseModel: PoseModelId;
}

export const defaultAppPreferences: AppPreferences = {
  showSkeleton: true,
  showCaptureHints: true,
  defaultAssistance: false,
  poseModel: 'lite',
};

export function parseAppPreferences(value: unknown): AppPreferences {
  const record = readObject(value);
  // 旧偏好没有模型字段，沿用原来的 Lite，不静默接受未知型号。
  const poseModel = record.poseModel === undefined ? 'lite' : record.poseModel;
  if (
    typeof record.showSkeleton !== 'boolean' ||
    typeof record.showCaptureHints !== 'boolean' ||
    typeof record.defaultAssistance !== 'boolean' ||
    !isPoseModelId(poseModel)
  )
    throw new Error('采集偏好格式不正确');
  return {
    showSkeleton: record.showSkeleton,
    showCaptureHints: record.showCaptureHints,
    defaultAssistance: record.defaultAssistance,
    poseModel,
  };
}

export interface PreferencesRepository {
  readonly isAvailable: boolean;
  readonly canSelectPoseModel?: boolean;
  load(): Promise<AppPreferences>;
  save(value: AppPreferences): Promise<AppPreferences>;
}
