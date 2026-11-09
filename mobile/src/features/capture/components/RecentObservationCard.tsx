import { FileText } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { taskStatusLabels } from '@/domain/observations/types';
import type { ObservationSummary } from '@/domain/observations/types';
import { affectedSideLabels } from '@/domain/patients/types';
import { formatDateTime } from '@/shared/lib/formatDateTime';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface RecentObservationCardProps {
  readonly observation: ObservationSummary;
  readonly onPress: () => void;
}

export function RecentObservationCard({ observation, onPress }: RecentObservationCardProps) {
  const theme = useAppTheme();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="查看最近记录" onPress={onPress}>
      <AppCard className="min-h-[84px] flex-row items-center gap-3 p-4">
        <FileText color={theme.foreground} size={22} />
        <View className="flex-1 gap-1">
          <AppText className="font-medium">{observation.taskName}</AppText>
          <AppText className="text-muted" variant="caption">
            {formatDateTime(observation.observedAt)} ·{' '}
            {affectedSideLabels[observation.affectedSide]}
          </AppText>
        </View>
        <View className="shrink-0 rounded-md bg-default px-2 py-1">
          <AppText className="text-muted" variant="meta">
            {taskStatusLabels[observation.taskStatus]}
          </AppText>
        </View>
      </AppCard>
    </Pressable>
  );
}
