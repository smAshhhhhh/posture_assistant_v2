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
  readonly durationMs: number;
  readonly hasAssistance: boolean;
  readonly showCaptureHints: boolean;
}

export function CaptureFeedbackCard({
  session,
  camera,
  isPreviewActive,
  durationMs,
  hasAssistance,
  showCaptureHints,
}: CaptureFeedbackCardProps) {
  const feedback = getCaptureFeedback(session, camera, isPreviewActive);
  const instructions = getTaskInstructions(session.context.taskId, session.context.affectedSide);
  const hasStarted = session.phase === 'capturing' || session.phase === 'paused';
  const seconds = Math.floor(durationMs / 1_000);
  const duration = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  if (!hasStarted) return null;

  return (
    <AppCard className="gap-3">
      <AppText variant="section">当前观察</AppText>
      <View className="gap-2" accessibilityLiveRegion="polite">
        <AppText>{feedback.title}</AppText>
        <AppText variant="caption" className="text-muted">
          {feedback.message}
        </AppText>
      </View>
      {showCaptureHints && session.phase !== 'paused' ? (
        <AppText>{instructions.movement}</AppText>
      ) : null}
      <AppText className="text-[28px] leading-9">{duration}</AppText>
      <AppText className="text-muted">
        {hasAssistance ? '存在辅助' : '无辅助'} ·{session.phase === 'paused' ? '已暂停' : '采集中'}
      </AppText>
      <AppText variant="caption">出现疼痛、头晕或明显疲劳时，请暂停或结束观察。</AppText>
    </AppCard>
  );
}
