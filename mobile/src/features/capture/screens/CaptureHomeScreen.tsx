import { Pressable, View } from 'react-native';

import type { ObservationSummary } from '@/domain/observations/types';
import type { PatientSummary } from '@/domain/patients/types';
import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppText } from '@/shared/ui/AppText';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { PatientContextCard } from '../components/PatientContextCard';
import { RecentObservationCard } from '../components/RecentObservationCard';
import { TaskOverviewCard } from '../components/TaskOverviewCard';

interface CaptureHomeScreenProps {
  readonly patient: PatientSummary | null;
  readonly task: RehabTask;
  readonly latestObservation: ObservationSummary | null;
  readonly isDesignPreview: boolean;
  readonly onSelectPatient: () => void;
  readonly onSelectTask: () => void;
  readonly onOpenHistory: () => void;
  readonly onHelp: () => void;
}

export function CaptureHomeScreen({
  patient,
  task,
  latestObservation,
  isDesignPreview,
  onSelectPatient,
  onSelectTask,
  onOpenHistory,
  onHelp,
}: CaptureHomeScreenProps) {
  return (
    <ScreenLayout header={<AppHeader onHelp={onHelp} />}>
      <View className="gap-2">
        <AppText accessibilityRole="header" variant="title">
          康复观察
        </AppText>
        <AppText className="text-muted" variant="caption">
          每次观察，都从清晰的动作开始。
        </AppText>
        {isDesignPreview ? (
          <AppText className="text-muted" variant="meta">
            设计预览 · 患者和记录均为虚构样例
          </AppText>
        ) : null}
      </View>
      <View className="gap-4">
        <PatientContextCard patient={patient} onPress={onSelectPatient} />
        <TaskOverviewCard task={task} onSelectTask={onSelectTask} />
      </View>
      <View className="gap-4">
        <View className="min-h-12 flex-row items-center justify-between gap-3">
          <AppText variant="section">最近一次</AppText>
          <Pressable
            accessibilityRole="button"
            className="min-h-12 justify-center"
            onPress={onOpenHistory}
          >
            <AppText className="text-muted" variant="caption">
              全部记录
            </AppText>
          </Pressable>
        </View>
        {latestObservation ? (
          <RecentObservationCard observation={latestObservation} onPress={onOpenHistory} />
        ) : (
          <EmptyState
            title="还没有采集记录"
            description="完成一次观察后，可以在这里查看最近记录。"
          />
        )}
      </View>
    </ScreenLayout>
  );
}
