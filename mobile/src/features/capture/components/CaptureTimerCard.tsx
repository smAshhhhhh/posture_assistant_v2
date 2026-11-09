import type { CapturePhase } from '@/domain/capture/captureSession';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface CaptureTimerCardProps {
  readonly phase: CapturePhase;
  readonly durationMs: number;
  readonly hasAssistance: boolean;
}

export function CaptureTimerCard({ phase, durationMs, hasAssistance }: CaptureTimerCardProps) {
  if (phase !== 'capturing' && phase !== 'paused') return null;

  const seconds = Math.floor(durationMs / 1_000);
  const duration = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  return (
    <AppCard className="gap-3">
      <AppText variant="section">采集计时</AppText>
      <AppText className="text-[28px] leading-9">{duration}</AppText>
      <AppText className="text-muted">
        {hasAssistance ? '存在辅助' : '无辅助'} · {phase === 'paused' ? '已暂停' : '采集中'}
      </AppText>
    </AppCard>
  );
}
