import { captureQualityLabels, taskStatusLabels } from '@/domain/observations/types';
import type { ObservationSummary } from '@/domain/observations/types';
import { formatDateTime } from '@/shared/lib/formatDateTime';
import { AppSummaryCard } from '@/shared/ui/AppSummaryCard';

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
    <AppSummaryCard
      title={observation.taskName}
      description={`${patientCode} · ${affectedSide} · ${observedAt}`}
      summary={`${taskStatus} · ${repetitions} · ${duration}`}
      tagLabel={quality}
      tagColor={
        observation.captureQuality === 'valid'
          ? 'success'
          : observation.captureQuality === 'degraded'
            ? 'warning'
            : 'danger'
      }
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
    />
  );
}
