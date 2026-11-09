import { View } from 'react-native';

import { affectedSideLabels } from '@/domain/patients/types';
import type { PatientSummary } from '@/domain/patients/types';
import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { getTaskInstructions } from '@/domain/tasks/taskInstructions';
import { AppCard } from '@/shared/ui/AppCard';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface CaptureTaskScreenProps {
  readonly task: RehabTask;
  readonly patient: PatientSummary | null;
  readonly onBack: () => void;
}

export function CaptureTaskScreen({ task, patient, onBack }: CaptureTaskScreenProps) {
  const instructions = getTaskInstructions(task.id, patient?.affectedSide ?? 'left');

  return (
    <ScreenLayout hasTabBar={false} header={<AppHeader onBack={onBack} title="任务说明" />}>
      <AppCard className="gap-2">
        <AppText className="text-muted" variant="caption">
          {task.bodyRegion} · {task.posture}
        </AppText>
        <AppText accessibilityRole="header" variant="title">
          {task.name}
        </AppText>
        <AppText className="text-muted">
          {patient
            ? `${patient.patientCode} · ${affectedSideLabels[patient.affectedSide]}`
            : '动作说明以左侧为例，采集时按患者实际患侧执行。'}
        </AppText>
      </AppCard>
      <View className="gap-3">
        <AppText variant="section">怎么做</AppText>
        <AppText>{instructions.movement}</AppText>
      </View>
      <AppCardStack>
        <AppCard className="gap-4">
          <View className="gap-2">
            <AppText className="font-medium">{task.cameraView}</AppText>
            <AppText className="text-muted">{instructions.framing}</AppText>
          </View>
          <View className="gap-2">
            <AppText className="font-medium">支撑与陪护</AppText>
            <AppText className="text-muted">{instructions.support}</AppText>
          </View>
        </AppCard>
        <AppCard className="gap-3">
          <AppText variant="section">注意事项</AppText>
          <AppText>{instructions.safety}</AppText>
          {instructions.measurementNotice ? (
            <AppText>{instructions.measurementNotice}</AppText>
          ) : null}
          {task.requiresSafetyConfirmation && patient?.abilityLevel === 'severe' ? (
            <AppText>当前档案为重度（专业评定），请由治疗师重新确认本任务是否适用。</AppText>
          ) : null}
        </AppCard>
      </AppCardStack>
    </ScreenLayout>
  );
}
