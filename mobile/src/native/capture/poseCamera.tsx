import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { Platform, View } from 'react-native';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

import { parsePoseCameraState } from '@/domain/capture/poseCamera';
import type { PoseCameraGateway, PoseCameraPreviewProps } from '@/domain/capture/poseCamera';
import { parsePoseRecording } from '@/domain/observations/poseRecording';

interface NativePoseCameraModule {
  recordingVersion?: () => number;
  videoRecordingVersion?: () => number;
  beginRecording?(resume: boolean): Promise<void>;
  finishRecording?(): Promise<string>;
  clearRecording?(): void;
  discardVideo?(id: string): Promise<void>;
  discardRecording?(): Promise<void>;
  stop(): Promise<void>;
}

interface NativePoseCameraProps extends ViewProps {
  readonly active: boolean;
  readonly showSkeleton: boolean;
  readonly requiredLandmarks: readonly number[];
  readonly onStatus: (event: NativeSyntheticEvent<unknown>) => void;
}

const nativeModule =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NativePoseCameraModule>('PostureCamera')
    : null;
const NativePreview = nativeModule
  ? requireNativeView<NativePoseCameraProps>('PostureCamera')
  : null;

export const poseCameraGateway: PoseCameraGateway = {
  isAvailable: nativeModule !== null,
  canRecord: nativeModule?.recordingVersion?.() === 1,
  canRecordVideo: nativeModule?.videoRecordingVersion?.() === 1,
  async beginRecording(resume) {
    if (!nativeModule?.beginRecording) throw new Error('请更新采集模块');
    await nativeModule.beginRecording(resume);
  },
  async finishRecording() {
    if (!nativeModule?.finishRecording) throw new Error('请更新采集模块');
    const value: unknown = JSON.parse(await nativeModule.finishRecording());
    const recording = parsePoseRecording(value);
    nativeModule.clearRecording?.();
    return recording;
  },
  async stop() {
    await nativeModule?.stop();
  },
  async discardVideo(id) {
    await nativeModule?.discardVideo?.(id);
  },
  async discardRecording() {
    await nativeModule?.discardRecording?.();
  },
};

export function PoseCameraPreview({
  active,
  showSkeleton,
  requiredLandmarks,
  onStatus,
}: PoseCameraPreviewProps) {
  if (!NativePreview) return <View style={{ flex: 1 }} />;

  return (
    <NativePreview
      active={active}
      showSkeleton={showSkeleton}
      onStatus={(event) => {
        const state = parsePoseCameraState(event.nativeEvent);
        if (state) onStatus(state);
      }}
      requiredLandmarks={requiredLandmarks}
      style={{ flex: 1 }}
    />
  );
}
