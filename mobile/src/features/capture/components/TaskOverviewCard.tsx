import { Activity } from 'lucide-react-native';
import { View } from 'react-native';

import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface TaskOverviewCardProps {
  readonly task: RehabTask;
  readonly onSelectTask: () => void;
}

export function TaskOverviewCard({ task, onSelectTask }: TaskOverviewCardProps) {
  const theme = useAppTheme();

  return (
    <AppCard className="gap-4">
      <AppText variant="section">开始一次新观察</AppText>
      <AppText className="text-muted" variant="caption">
        选择康复任务，按提示摆好手机。
      </AppText>
      <View className="gap-3 rounded-[20px] bg-surface-secondary p-5">
        <AppText className="text-muted" variant="meta">
          {task.bodyRegion} · {task.posture}
        </AppText>
        <View className="flex-row items-center gap-3">
          <AppText className="flex-1 text-[22px] leading-8 font-semibold">{task.name}</AppText>
          <Activity color={theme.accent} size={30} />
        </View>
        <AppText className="text-muted" variant="caption">
          {task.cameraView} · {task.estimatedDuration}
        </AppText>
      </View>
      <AppButton onPress={onSelectTask}>选择任务，开始观察</AppButton>
    </AppCard>
  );
}
