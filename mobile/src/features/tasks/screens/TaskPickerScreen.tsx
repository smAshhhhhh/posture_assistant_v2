import { RadioGroup } from 'heroui-native/radio-group';
import { Button } from 'heroui-native/button';
import { ChevronRight, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { rehabTasks } from '@/domain/tasks/taskCatalog';
import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppCard } from '@/shared/ui/AppCard';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface TaskPickerScreenProps {
  readonly selectedTask: RehabTask;
  readonly onSelectTask: (task: RehabTask) => void;
  readonly onOpenTask: (task: RehabTask) => void;
  readonly onBack: () => void;
}

export function TaskPickerScreen({
  selectedTask,
  onSelectTask,
  onOpenTask,
  onBack,
}: TaskPickerScreenProps) {
  const theme = useAppTheme();

  return (
    <ScreenLayout hasTabBar={false} header={<AppHeader onBack={onBack} title="康复任务" />}>
      <View className="gap-2">
        <AppText accessibilityRole="header" variant="title">
          选择观察任务
        </AppText>
        <AppText className="text-muted" variant="caption">
          根据患者能力选择，站立与步行任务需治疗师确认安全条件。
        </AppText>
      </View>
      <RadioGroup
        className="gap-4"
        accessibilityLabel="当前观察动作"
        value={selectedTask.id}
        onValueChange={(taskId) => {
          const task = rehabTasks.find((item) => item.id === taskId);
          if (task) onSelectTask(task);
        }}
      >
        {rehabTasks.map((task) => {
          const isSelected = task.id === selectedTask.id;
          return (
            <AppCard
              key={task.id}
              className={
                'min-h-[82px] flex-row items-stretch overflow-hidden border ' +
                (isSelected ? 'border-accent' : 'border-transparent')
              }
            >
              {isSelected ? (
                <View pointerEvents="none" className="absolute inset-0 bg-accent/5" />
              ) : null}
              <RadioGroup.Item
                accessibilityLabel={`选择${task.name}作为观察动作`}
                className="min-w-0 flex-1 p-0"
                hitSlop={{ top: 16, bottom: 16, left: 16 }}
                value={task.id}
              >
                <View className="flex-1 gap-1">
                  <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
                    <AppText className="shrink font-medium">{task.name}</AppText>
                    {isSelected ? (
                      <AppText
                        variant="caption"
                        className="font-medium text-accent-soft-foreground"
                      >
                        当前动作
                      </AppText>
                    ) : null}
                  </View>
                  <AppText className="text-muted" variant="caption">
                    {task.bodyRegion} · {task.posture}
                  </AppText>
                  {task.requiresSafetyConfirmation ? (
                    <View className="flex-row items-center gap-2">
                      <ShieldCheck color={theme.muted} size={16} />
                      <AppText className="text-muted" variant="meta">
                        开始前需确认安全条件
                      </AppText>
                    </View>
                  ) : null}
                </View>
              </RadioGroup.Item>
              <Button
                isIconOnly
                variant="ghost"
                accessibilityLabel={`查看${task.name}的任务说明`}
                accessibilityRole="button"
                className="min-h-14 w-14 items-center justify-end rounded-full p-0"
                hitSlop={{ top: 16, bottom: 16, right: 16 }}
                onPress={() => onOpenTask(task)}
              >
                <ChevronRight color={theme.muted} size={20} />
              </Button>
            </AppCard>
          );
        })}
      </RadioGroup>
      <AppText className="text-muted" variant="caption">
        点击卡片选定动作并返回首页；右侧箭头查看任务说明。
      </AppText>
    </ScreenLayout>
  );
}
