import { View } from 'react-native';

import { captureQualityLabels, taskStatusLabels } from '@/domain/observations/types';
import type { ObservationSummary } from '@/domain/observations/types';
import { formatDateTime } from '@/shared/lib/formatDateTime';
import { AppCard } from '@/shared/ui/AppCard';
import { AppPressable } from '@/shared/ui/AppPressable';
import { AppText } from '@/shared/ui/AppText';

import { CaptureQualityChip } from './CaptureQualityChip';

interface HistoryObservationCardProps {
  readonly observation: ObservationSummary;
  readonly patientCode: string;
  readonly onPress: () => void;
}

export function HistoryObservationCard({
  observation,
  patientCode,
  onPress,
}: HistoryObservationCardProps) {
  const observedAt = formatDateTime(observation.observedAt);
  const affectedSide = observation.affectedSide === 'left' ? '左侧' : '右侧';
  const quality = captureQualityLabels[observation.captureQuality];
  const taskStatus = taskStatusLabels[observation.taskStatus];
  const repetitionPrefix = observation.taskId === 'short_walk' ? '患侧周期 ' : '';
  const repetitionUnit = observation.taskId === 'march_in_place' ? '步' : '次';
  const repetitions = `${repetitionPrefix}${observation.repetitions ?? '—'} ${repetitionUnit}`;
  const duration = `${(observation.durationMs / 1_000).toFixed(1)} 秒`;

  return (
    <AppPressable
      className="rounded-[24px]"
      accessibilityRole="button"
      accessibilityLabel={[
        patientCode,
        observation.taskName,
        observedAt,
        affectedSide,
        quality,
        taskStatus,
        repetitions,
        duration,
      ].join('，')}
      accessibilityHint="打开观察报告"
      onPress={onPress}
    >
      <AppCard className="gap-1">
        <View className="flex-row items-start gap-3">
          <AppText className="min-w-0 flex-1 font-medium">{observation.taskName}</AppText>
          <CaptureQualityChip quality={observation.captureQuality} />
        </View>
        <AppText className="text-muted" variant="caption">
          {patientCode} · {affectedSide} · {observedAt}
        </AppText>
        <AppText variant="caption">
          {taskStatus} · {repetitions} · {duration}
        </AppText>
      </AppCard>
    </AppPressable>
  );
}
