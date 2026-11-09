import { Button } from 'heroui-native/button';
import { RadioGroup } from 'heroui-native/radio-group';
import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface TaskOptionCardProps {
  readonly task: RehabTask;
  readonly isSelected: boolean;
  readonly onOpen: () => void;
}

export function TaskOptionCard({ task, isSelected, onOpen }: TaskOptionCardProps) {
  const theme = useAppTheme();

  return (
    <AppCard
      className={
        'min-h-[82px] flex-row items-stretch overflow-hidden border ' +
        (isSelected ? 'border-accent' : 'border-transparent')
      }
    >
      {isSelected ? <View pointerEvents="none" className="absolute inset-0 bg-accent/5" /> : null}
      <RadioGroup.Item
        accessibilityLabel={`选择${task.name}作为观察动作`}
        className="min-h-12 min-w-0 flex-1 p-0"
        hitSlop={{ top: 16, bottom: 16, left: 16 }}
        value={task.id}
      >
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <AppText className="shrink font-medium">{task.name}</AppText>
            {isSelected ? (
              <AppText variant="caption" className="font-medium text-accent-soft-foreground">
                当前动作
              </AppText>
            ) : null}
          </View>
          <AppText className="text-muted" variant="caption">
            {task.bodyRegion} · {task.posture}
          </AppText>
        </View>
      </RadioGroup.Item>
      <Button
        isIconOnly
        variant="ghost"
        accessibilityLabel={`查看${task.name}的任务说明`}
        accessibilityRole="button"
        className="min-h-12 w-12 self-center items-center justify-end rounded-full p-0"
        hitSlop={{ top: 16, bottom: 16, right: 16 }}
        onPress={onOpen}
      >
        <ChevronRight color={theme.muted} size={20} />
      </Button>
    </AppCard>
  );
}
