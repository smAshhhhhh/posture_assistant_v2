import { Check, ShieldCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

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
  readonly onBack: () => void;
}

export function TaskPickerScreen({ selectedTask, onSelectTask, onBack }: TaskPickerScreenProps) {
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
      <View className="gap-3">
        {rehabTasks.map((task) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: task.id === selectedTask.id }}
            key={task.id}
            onPress={() => onSelectTask(task)}
          >
            <AppCard className="flex-row items-center gap-3 p-4">
              <View className="flex-1 gap-1">
                <AppText className="font-medium">{task.name}</AppText>
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
              {task.id === selectedTask.id ? <Check color={theme.accent} size={20} /> : null}
            </AppCard>
          </Pressable>
        ))}
      </View>
      <AppText className="text-muted" variant="caption">
        选择任务后查看动作说明并确认安全条件，再进入采集准备。
      </AppText>
    </ScreenLayout>
  );
}
