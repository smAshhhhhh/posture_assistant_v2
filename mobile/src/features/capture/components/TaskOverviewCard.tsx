import { View } from 'react-native';

import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppMovementIcon } from '@/shared/ui/AppMovementIcon';
import { AppPressable } from '@/shared/ui/AppPressable';
import { AppText } from '@/shared/ui/AppText';

interface TaskOverviewCardProps {
  readonly task: RehabTask;
  readonly onSelectTask: () => void;
  readonly onStartObservation: () => void;
}

export function TaskOverviewCard({
  task,
  onSelectTask,
  onStartObservation,
}: TaskOverviewCardProps) {
  return (
    <AppCard className="gap-4">
      <AppText variant="section">开始一次新观察</AppText>
      <AppText className="text-muted" variant="caption">
        选择康复任务，按提示摆好手机。
      </AppText>
      <AppPressable
        accessibilityLabel={`当前动作 ${task.name}，点击更换观察动作`}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-[20px] bg-surface-secondary p-4"
        onPress={onSelectTask}
      >
        <View className="min-w-0 flex-1 gap-3">
          <AppText className="text-muted" variant="meta">
            {task.bodyRegion} · {task.posture}
          </AppText>
          <AppText className="text-[22px] leading-8 font-semibold">{task.name}</AppText>
          <AppText className="text-muted" variant="caption">
            {task.cameraView} · {task.estimatedDuration}
          </AppText>
        </View>
        <View className="size-16 shrink-0" pointerEvents="none">
          <AppMovementIcon name={task.id} size={64} />
        </View>
      </AppPressable>
      <AppButton onPress={onStartObservation}>开始观察</AppButton>
    </AppCard>
  );
}
