import { readObject } from '../observations/poseRecording';

export interface AppPreferences {
  readonly showSkeleton: boolean;
  readonly showCaptureHints: boolean;
  readonly defaultAssistance: boolean;
}

export const defaultAppPreferences: AppPreferences = {
  showSkeleton: true,
  showCaptureHints: true,
  defaultAssistance: false,
};

export function parseAppPreferences(value: unknown): AppPreferences {
  const record = readObject(value);
  if (
    typeof record.showSkeleton !== 'boolean' ||
    typeof record.showCaptureHints !== 'boolean' ||
    typeof record.defaultAssistance !== 'boolean'
  )
    throw new Error('采集偏好格式不正确');
  return {
    showSkeleton: record.showSkeleton,
    showCaptureHints: record.showCaptureHints,
    defaultAssistance: record.defaultAssistance,
  };
}

export interface PreferencesRepository {
  readonly isAvailable: boolean;
  load(): Promise<AppPreferences>;
  save(value: AppPreferences): Promise<AppPreferences>;
}
