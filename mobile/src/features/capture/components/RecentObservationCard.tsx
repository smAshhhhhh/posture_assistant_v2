import { FileText } from 'lucide-react-native';
import { Chip } from 'heroui-native/chip';
import { View } from 'react-native';

import { taskStatusLabels } from '@/domain/observations/types';
import type { ObservationSummary } from '@/domain/observations/types';
import { affectedSideLabels } from '@/domain/patients/types';
import { formatDateTime } from '@/shared/lib/formatDateTime';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppCard } from '@/shared/ui/AppCard';
import { AppPressable } from '@/shared/ui/AppPressable';
import { AppText } from '@/shared/ui/AppText';

interface RecentObservationCardProps {
  readonly observation: ObservationSummary;
  readonly onPress: () => void;
}

export function RecentObservationCard({ observation, onPress }: RecentObservationCardProps) {
  const theme = useAppTheme();

  return (
    <AppPressable
      className="rounded-[24px]"
      accessibilityRole="button"
      accessibilityLabel="查看最近记录"
      onPress={onPress}
    >
      <AppCard className="min-h-[84px] flex-row items-center gap-3 p-4">
        <FileText color={theme.foreground} size={22} />
        <View className="flex-1 gap-1">
          <AppText className="font-medium">{observation.taskName}</AppText>
          <AppText className="text-muted" variant="caption">
            {formatDateTime(observation.observedAt)} ·{' '}
            {affectedSideLabels[observation.affectedSide]}
          </AppText>
        </View>
        <Chip
          className="max-w-[45%] shrink"
          pointerEvents="none"
          accessibilityRole="text"
          size="sm"
          variant="secondary"
        >
          <Chip.Label className="shrink text-xs leading-[18px] text-muted">
            {taskStatusLabels[observation.taskStatus]}
          </Chip.Label>
        </Chip>
      </AppCard>
    </AppPressable>
  );
}
