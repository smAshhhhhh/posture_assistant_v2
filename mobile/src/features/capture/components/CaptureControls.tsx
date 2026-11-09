import { View } from 'react-native';

import type { CapturePhase } from '@/domain/capture/captureSession';
import { AppButton } from '@/shared/ui/AppButton';

interface CaptureControlsProps {
  readonly phase: CapturePhase;
  readonly canBegin: boolean;
  readonly isStarting: boolean;
  readonly onBegin: () => void;
  readonly onStop: (action: 'pause' | 'finish') => void;
}

export function CaptureControls({
  phase,
  canBegin,
  isStarting,
  onBegin,
  onStop,
}: CaptureControlsProps) {
  const isCapturing = phase === 'capturing';
  const isPaused = phase === 'paused';

  return (
    <View className="flex-row gap-4">
      {isCapturing ? (
        <AppButton className="flex-1" onPress={() => onStop('pause')} variant="secondary">
          暂停
        </AppButton>
      ) : (
        <AppButton className="flex-1" isDisabled={!canBegin} onPress={onBegin}>
          {isStarting ? '正在恢复…' : isPaused ? '继续采集' : '开始采集'}
        </AppButton>
      )}
      {isCapturing || isPaused ? (
        <AppButton className="flex-1" onPress={() => onStop('finish')} variant="danger">
          结束观察
        </AppButton>
      ) : null}
    </View>
  );
}
