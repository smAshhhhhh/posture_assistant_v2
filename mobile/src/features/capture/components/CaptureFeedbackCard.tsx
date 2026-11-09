import { View } from 'react-native';

import { getCaptureFeedback } from '@/domain/capture/captureFeedback';
import type { CaptureSession } from '@/domain/capture/captureSession';
import type { PoseCameraState } from '@/domain/capture/poseCamera';
import { getTaskInstructions } from '@/domain/tasks/taskInstructions';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface CaptureFeedbackCardProps {
  readonly session: CaptureSession;
  readonly camera: PoseCameraState;
  readonly isPreviewActive: boolean;
  readonly showCaptureHints: boolean;
}

export function CaptureFeedbackCard({
  session,
  camera,
  isPreviewActive,
  showCaptureHints,
}: CaptureFeedbackCardProps) {
  const feedback = getCaptureFeedback(session, camera, isPreviewActive);
  const instructions = getTaskInstructions(session.context.taskId, session.context.affectedSide);
  const hasStarted = session.phase === 'capturing' || session.phase === 'paused';

  if (!hasStarted) return null;

  return (
    <AppCard className="gap-3">
      <AppText variant="section">动作指导</AppText>
      <View className="gap-2" accessibilityLiveRegion="polite">
        <AppText>{feedback.title}</AppText>
        <AppText variant="caption" className="text-muted">
          {feedback.message}
        </AppText>
      </View>
      {showCaptureHints && session.phase !== 'paused' ? (
        <AppText>{instructions.movement}</AppText>
      ) : null}
      {instructions.measurementNotice ? <AppText>{instructions.measurementNotice}</AppText> : null}
      <AppText variant="caption">出现疼痛、头晕或明显疲劳时，请暂停或结束观察。</AppText>
    </AppCard>
  );
}
