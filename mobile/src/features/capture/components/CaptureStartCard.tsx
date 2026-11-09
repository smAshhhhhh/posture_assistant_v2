import { ControlField } from 'heroui-native/control-field';
import { Label } from 'heroui-native/label';

import type { PatientProfile } from '@/domain/patients/patientRecord';
import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { getTaskInstructions } from '@/domain/tasks/taskInstructions';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface CaptureStartCardProps {
  readonly task: RehabTask;
  readonly patient: PatientProfile;
  readonly isConfirmed: boolean;
  readonly isStarting: boolean;
  readonly onConfirm: (isConfirmed: boolean) => void;
  readonly onBegin: () => void;
}

export function CaptureStartCard({
  task,
  patient,
  isConfirmed,
  isStarting,
  onConfirm,
  onBegin,
}: CaptureStartCardProps) {
  const instructions = getTaskInstructions(task.id, patient.affectedSide);
  return (
    <AppCard className="gap-3">
      <AppText variant="section">开始前确认</AppText>
      <AppText variant="caption" className="text-muted">
        {instructions.safety}
      </AppText>
      {task.requiresSafetyConfirmation && patient.abilityLevel === 'severe' ? (
        <AppText variant="caption">
          当前档案为重度（专业评定），请由治疗师重新确认本任务是否适用。
        </AppText>
      ) : null}
      <ControlField
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isConfirmed }}
        className="min-h-[52px] gap-3"
        isSelected={isConfirmed}
        isDisabled={isStarting}
        onSelectedChange={onConfirm}
      >
        <ControlField.Indicator variant="checkbox" />
        <Label className="flex-1 text-base">
          {task.requiresSafetyConfirmation
            ? '已阅读并确认：治疗师已确认适用性与安全条件'
            : '已阅读并确认：患者准备好且环境安全'}
        </Label>
      </ControlField>
      <AppButton isDisabled={!isConfirmed || isStarting} onPress={onBegin}>
        {isStarting ? '正在开始…' : '开始采集'}
      </AppButton>
    </AppCard>
  );
}
