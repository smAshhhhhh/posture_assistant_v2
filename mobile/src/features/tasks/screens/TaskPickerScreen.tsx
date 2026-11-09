import { RadioGroup } from 'heroui-native/radio-group';
import { View } from 'react-native';

import { rehabTasks } from '@/domain/tasks/taskCatalog';
import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { TaskOptionCard } from '../components/TaskOptionCard';
import { getTaskSections } from '../model/taskPickerSections';

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
  return (
    <ScreenLayout hasTabBar={false} header={<AppHeader onBack={onBack} title="康复任务" />}>
      <View className="gap-2">
        <AppText accessibilityRole="header" variant="title">
          选择观察任务
        </AppText>
        <AppText className="text-muted" variant="caption">
          根据患者能力选择本次观察任务。
        </AppText>
      </View>
      <RadioGroup
        className="gap-6"
        accessibilityLabel="当前观察动作"
        value={selectedTask.id}
        onValueChange={(taskId) => {
          const task = rehabTasks.find((item) => item.id === taskId);
          if (task) onSelectTask(task);
        }}
      >
        {getTaskSections(rehabTasks).map((section) => (
          <View key={section.id} className="gap-4">
            <AppText accessibilityRole="header" variant="section">
              {section.title}
            </AppText>
            <AppCardStack>
              {section.tasks.map((task) => (
                <TaskOptionCard
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTask.id}
                  onOpen={() => onOpenTask(task)}
                />
              ))}
            </AppCardStack>
          </View>
        ))}
      </RadioGroup>
      <AppText className="text-muted" variant="caption">
        点击卡片选定动作并返回首页；右侧箭头查看任务说明。
      </AppText>
    </ScreenLayout>
  );
}
