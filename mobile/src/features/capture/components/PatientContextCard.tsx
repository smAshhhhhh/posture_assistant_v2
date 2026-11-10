import { UserRoundPlus } from 'lucide-react-native';
import { Keyboard, View } from 'react-native';

import { abilityLevelLabels, affectedSideLabels } from '@/domain/patients/types';
import type { PatientSummary } from '@/domain/patients/types';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppButton } from '@/shared/ui/AppButton';
import { AppAvatar } from '@/shared/ui/AppAvatar';
import { AppSearchSelect } from '@/shared/ui/AppSearchSelect';
import { AppText } from '@/shared/ui/AppText';
import { AppTag } from '@/shared/ui/AppTag';

interface PatientContextCardProps {
  readonly patient: PatientSummary | null;
  readonly patients: readonly PatientSummary[];
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onSelectPatient: (patientId: string) => void;
  readonly onCreatePatient: () => void;
}

export function PatientContextCard({
  patient,
  patients,
  isOpen,
  onOpenChange,
  onSelectPatient,
  onCreatePatient,
}: PatientContextCardProps) {
  const theme = useAppTheme();
  return (
    <AppSearchSelect
      label="选择患者"
      searchLabel="搜索患者编号"
      value={patient?.id ?? null}
      options={patients.map((item) => {
        const ability = item.abilityLevel ? abilityLevelLabels[item.abilityLevel] : '待专业评估';
        return {
          value: item.id,
          label: item.patientCode,
          description: `${affectedSideLabels[item.affectedSide]} · ${ability}`,
          triggerDescription:
            `${affectedSideLabels[item.affectedSide]} · ${ability}` +
            (item.abilityLevel ? '（治疗师评定）' : ''),
          triggerDescriptionContent: (
            <View className="flex-row flex-wrap gap-2">
              <AppTag label={affectedSideLabels[item.affectedSide]} />
              <AppTag label={ability + (item.abilityLevel ? '（治疗师评定）' : '')} />
            </View>
          ),
          startContent: <AppAvatar label={item.patientCode} imageUri={item.photoUri} />,
        };
      })}
      placeholder={{
        label: '选择患者',
        description: '先记录基本资料，再开始观察',
        startContent: <UserRoundPlus color={theme.muted} size={20} />,
      }}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onChange={onSelectPatient}
      emptyContent={
        <View className="gap-3">
          <AppText className="text-muted">还没有患者档案</AppText>
          <AppButton
            onPress={() => {
              Keyboard.dismiss();
              onOpenChange(false);
              onCreatePatient();
            }}
          >
            建立患者档案
          </AppButton>
        </View>
      }
    />
  );
}
