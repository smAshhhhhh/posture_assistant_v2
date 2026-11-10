import type { CaptureSession } from '@/domain/capture/captureSession';
import { getTaskInstructions } from '@/domain/tasks/taskInstructions';
import { AppAccordion } from '@/shared/ui/AppAccordion';
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
    <AppAccordion
      defaultExpandedIds={['guidance', 'measurement']}
      items={[
        ...(showMovement
          ? [
              {
                id: 'guidance',
                title: '动作指导',
                content: <AppText className="leading-[26px]">{instructions.movement}</AppText>,
              },
            ]
          : []),
        ...(instructions.measurementNotice
          ? [
              {
                id: 'measurement',
                title: '测量说明',
                content: (
                  <AppText variant="caption" className="text-muted">
                    {instructions.measurementNotice}
                  </AppText>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
