import { Alert } from 'heroui-native/alert';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { getCaptureFeedback } from '@/domain/capture/captureFeedback';
import type { CaptureSession } from '@/domain/capture/captureSession';
import type { PoseCameraState } from '@/domain/capture/poseCamera';
import { AppCard } from '@/shared/ui/AppCard';

interface CaptureFeedbackCardProps {
  readonly session: CaptureSession;
  readonly camera: PoseCameraState;
  readonly isPreviewActive: boolean;
}

const feedbackStatuses: Readonly<Record<string, ComponentProps<typeof Alert>['status']>> = {
  ready: 'success',
  waiting: 'default',
  paused: 'default',
  device_error: 'danger',
};

export function CaptureFeedbackCard({
  session,
  camera,
  isPreviewActive,
}: CaptureFeedbackCardProps) {
  const feedback = getCaptureFeedback(session, camera, isPreviewActive);
  const hasStarted = session.phase === 'capturing' || session.phase === 'paused';
  const status =
    camera.status === 'error' ? 'danger' : (feedbackStatuses[feedback.code] ?? 'warning');

  if (!hasStarted) return null;

  return (
    <AppCard>
      <Alert
        accessibilityLiveRegion={status === 'danger' ? 'assertive' : 'polite'}
        background={null}
        className="items-start rounded-none bg-transparent p-0 shadow-none"
        status={status}
      >
        <Alert.Content className="min-w-0 gap-1">
          <View className="flex-row items-start gap-2">
            <Alert.Indicator className="shrink-0 pt-0.5" iconProps={{ size: 18 }} />
            <Alert.Title className="min-w-0 flex-1 text-sm font-medium leading-[22px]">
              {feedback.title}
            </Alert.Title>
          </View>
          <Alert.Description className="text-sm leading-[22px]">
            {feedback.message}
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </AppCard>
  );
}
