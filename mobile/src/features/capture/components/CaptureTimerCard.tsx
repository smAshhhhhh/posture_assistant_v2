import { Chip } from 'heroui-native/chip';
import { View } from 'react-native';

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
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <AppText variant="section">采集计时</AppText>
        <Chip
          className="max-w-full shrink"
          pointerEvents="none"
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          color={phase === 'paused' ? 'warning' : 'accent'}
          size="sm"
          variant="soft"
        >
          <Chip.Label className="shrink">{phase === 'paused' ? '已暂停' : '采集中'}</Chip.Label>
        </Chip>
      </View>
      <AppText className="text-[28px] leading-9">{duration}</AppText>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <AppText className="text-muted">辅助情况</AppText>
        <Chip
          className="max-w-full shrink"
          pointerEvents="none"
          accessibilityRole="text"
          accessibilityLabel={`辅助情况：${hasAssistance ? '人工或器具辅助' : '无辅助'}`}
          color="default"
          size="sm"
          variant="soft"
        >
          <Chip.Label className="shrink">{hasAssistance ? '人工或器具辅助' : '无辅助'}</Chip.Label>
        </Chip>
      </View>
    </AppCard>
  );
}
