import { useState } from 'react';
import { Button } from 'heroui-native/button';
import { View } from 'react-native';

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
  readonly patients: readonly PatientSummary[];
  readonly task: RehabTask;
  readonly latestObservation: ObservationSummary | null;
  readonly onSelectPatient: (patientId: string) => void;
  readonly onCreatePatient: () => void;
  readonly onSelectTask: () => void;
  readonly onStartObservation: () => void;
  readonly onOpenHistory: () => void;
  readonly onHelp: () => void;
}

export function CaptureHomeScreen({
  patient,
  patients,
  task,
  latestObservation,
  onSelectPatient,
  onCreatePatient,
  onSelectTask,
  onStartObservation,
  onOpenHistory,
  onHelp,
}: CaptureHomeScreenProps) {
  const [isPatientPickerOpen, setIsPatientPickerOpen] = useState(false);

  return (
    <ScreenLayout header={<AppHeader onHelp={onHelp} />}>
      <View className="gap-2">
        <AppText accessibilityRole="header" variant="title">
          康复观察
        </AppText>
        <AppText className="text-muted" variant="caption">
          每次观察，都从清晰的动作开始。
        </AppText>
      </View>
      <View className="gap-4">
        <PatientContextCard
          patient={patient}
          patients={patients}
          isOpen={isPatientPickerOpen}
          onOpenChange={setIsPatientPickerOpen}
          onSelectPatient={onSelectPatient}
          onCreatePatient={onCreatePatient}
        />
        <TaskOverviewCard
          task={task}
          onSelectTask={onSelectTask}
          onStartObservation={patient ? onStartObservation : () => setIsPatientPickerOpen(true)}
        />
      </View>
      <View className="gap-4">
        <View className="min-h-12 flex-row items-center justify-between gap-3">
          <AppText variant="section">最近一次</AppText>
          <Button
            variant="ghost"
            accessibilityRole="button"
            className="min-h-12 justify-center rounded-full px-0"
            onPress={onOpenHistory}
          >
            <AppText className="text-muted" variant="caption">
              全部记录
            </AppText>
          </Button>
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
