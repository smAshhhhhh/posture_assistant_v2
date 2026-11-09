import { View } from 'react-native';

import { captureQualityLabels, taskStatusLabels } from '@/domain/observations/types';
import type { ObservationSummary } from '@/domain/observations/types';
import { affectedSideLabels } from '@/domain/patients/types';
import type { PatientSummary } from '@/domain/patients/types';
import { formatDateTime } from '@/shared/lib/formatDateTime';
import { AppCard } from '@/shared/ui/AppCard';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppText } from '@/shared/ui/AppText';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface HistoryScreenProps {
  readonly patient: PatientSummary | null;
  readonly observations: readonly ObservationSummary[];
}

export function HistoryScreen({ patient, observations }: HistoryScreenProps) {
  return (
    <ScreenLayout header={<AppHeader title="历史记录" />}>
      <View className="gap-2">
        <AppText accessibilityRole="header" variant="title">
          观察记录
        </AppText>
        <AppText className="text-muted" variant="caption">
          {patient?.patientCode ?? '尚未选择患者'} · 本机共 {observations.length} 条
        </AppText>
      </View>
      {observations.length === 0 ? (
        <EmptyState
          title="还没有采集记录"
          description="完成并保存一次观察后，可以在这里查看报告和历史记录。"
        />
      ) : (
        observations.map((observation) => (
          <AppCard className="gap-2" key={observation.id}>
            <AppText className="font-medium">{observation.taskName}</AppText>
            <AppText className="text-muted" variant="caption">
              {formatDateTime(observation.observedAt)} ·{' '}
              {affectedSideLabels[observation.affectedSide]}
            </AppText>
            <AppText className="text-muted" variant="caption">
              {taskStatusLabels[observation.taskStatus]} ·{' '}
              {captureQualityLabels[observation.captureQuality]}
            </AppText>
            <AppText variant="caption">
              {observation.repetitions === null ? '—' : observation.repetitions} 次 ·{' '}
              {observation.durationMs / 1_000} 秒
            </AppText>
          </AppCard>
        ))
      )}
      <AppText className="text-muted" variant="caption">
        任务状态与采集质量分别记录；质量不足不参与直接对比。
      </AppText>
    </ScreenLayout>
  );
}
