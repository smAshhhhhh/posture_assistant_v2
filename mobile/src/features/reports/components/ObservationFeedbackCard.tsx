import { View } from 'react-native';

import type { AngleAnalysis } from '@/domain/observations/angleAnalysis';
import type { AngleObservationTaskId } from '@/domain/observations/angleProtocols';
import { getObservationFeedback } from '@/domain/observations/observationFeedback';
import type { TaskStatus } from '@/domain/observations/types';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface ObservationFeedbackCardProps {
  readonly taskId: AngleObservationTaskId;
  readonly analysis: AngleAnalysis;
  readonly taskStatus: TaskStatus | null;
}

export function ObservationFeedbackCard({
  taskId,
  analysis,
  taskStatus,
}: ObservationFeedbackCardProps) {
  const feedback = getObservationFeedback(taskId, analysis, taskStatus);
  return (
    <AppCard className="gap-4">
      <AppText variant="section">观察提示</AppText>
      {feedback.map((item) => (
        <View key={item.code} className="gap-2">
          <AppText>{item.title}</AppText>
          <AppText variant="caption" className="text-muted">
            {item.message}
          </AppText>
        </View>
      ))}
    </AppCard>
  );
}
