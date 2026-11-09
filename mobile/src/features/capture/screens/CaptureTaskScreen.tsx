import { ControlField } from 'heroui-native/control-field';
import { Label } from 'heroui-native/label';
import { useState } from 'react';
import { View } from 'react-native';

import { affectedSideLabels } from '@/domain/patients/types';
import type { PatientSummary } from '@/domain/patients/types';
import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { getTaskInstructions } from '@/domain/tasks/taskInstructions';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface CaptureTaskScreenProps {
  readonly task: RehabTask;
  readonly patient: PatientSummary | null;
  readonly onBack: () => void;
  readonly onSelectPatient: () => void;
  readonly onContinue: () => void;
}

export function CaptureTaskScreen({
  task,
  patient,
  onBack,
  onSelectPatient,
  onContinue,
}: CaptureTaskScreenProps) {
  const [hasConfirmedSafety, setHasConfirmedSafety] = useState(false);

  if (!patient) {
    return (
      <ScreenLayout hasTabBar={false} header={<AppHeader onBack={onBack} title="任务说明" />}>
        <AppText accessibilityRole="header" variant="title">
          先选择患者
        </AppText>
        <AppCard className="gap-2">
          <AppText>{task.name}</AppText>
          <AppText className="text-muted">
            需要患者编号和患侧才能准备本次观察。请先在患者列表中选择档案。
          </AppText>
        </AppCard>
        <AppButton className="rounded-xl" onPress={onSelectPatient}>
          前往患者列表
        </AppButton>
      </ScreenLayout>
    );
  }

  const instructions = getTaskInstructions(task.id, patient.affectedSide);

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
          {patient.patientCode} · {affectedSideLabels[patient.affectedSide]}
        </AppText>
      </AppCard>
      <View className="gap-3">
        <AppText variant="section">怎么做</AppText>
        <AppText>{instructions.movement}</AppText>
      </View>
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
        <AppText variant="section">开始前确认</AppText>
        <AppText>{instructions.safety}</AppText>
        {task.requiresSafetyConfirmation && patient.abilityLevel === 'severe' ? (
          <AppText>当前档案为重度（专业评定），请由治疗师重新确认本任务是否适用。</AppText>
        ) : null}
        <ControlField
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasConfirmedSafety }}
          className="min-h-[52px] gap-3"
          isSelected={hasConfirmedSafety}
          onSelectedChange={setHasConfirmedSafety}
        >
          <ControlField.Indicator variant="checkbox" />
          <Label className="flex-1 text-base">
            {task.requiresSafetyConfirmation
              ? '治疗师已确认适用性与安全条件'
              : '已确认患者准备好且环境安全'}
          </Label>
        </ControlField>
      </AppCard>
      <View className="gap-3">
        <AppButton className="rounded-xl" isDisabled={!hasConfirmedSafety} onPress={onContinue}>
          已确认，检查机位
        </AppButton>
        {!hasConfirmedSafety ? (
          <AppText className="text-muted" variant="caption">
            确认安全条件后继续。
          </AppText>
        ) : null}
      </View>
    </ScreenLayout>
  );
}
