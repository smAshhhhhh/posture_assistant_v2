import { Separator } from 'heroui-native/separator';
import { View } from 'react-native';

import type { CaptureSession } from '@/domain/capture/captureSession';
import { getTaskInstructions } from '@/domain/tasks/taskInstructions';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface CaptureGuidanceCardProps {
  readonly session: CaptureSession;
  readonly showCaptureHints: boolean;
}

export function CaptureGuidanceCard({ session, showCaptureHints }: CaptureGuidanceCardProps) {
  const hasStarted = session.phase === 'capturing' || session.phase === 'paused';
  const instructions = getTaskInstructions(session.context.taskId, session.context.affectedSide);
  const showMovement = showCaptureHints && session.phase === 'capturing';

  if (!hasStarted || (!showMovement && !instructions.measurementNotice)) return null;

  return (
    <AppCard className="gap-4">
      <View className="gap-2">
        <AppText variant="section">动作指导</AppText>
        {showMovement ? (
          <AppText className="leading-[26px]">{instructions.movement}</AppText>
        ) : null}
      </View>
      {instructions.measurementNotice ? (
        <>
          {showMovement ? <Separator /> : null}
          <View className="gap-1">
            <AppText variant="meta" className="font-medium text-muted">
              测量说明
            </AppText>
            <AppText variant="caption" className="text-muted">
              {instructions.measurementNotice}
            </AppText>
          </View>
        </>
      ) : null}
    </AppCard>
  );
}
