import { ChevronRight, UserRoundPlus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { abilityLevelLabels, affectedSideLabels } from '@/domain/patients/types';
import type { PatientSummary } from '@/domain/patients/types';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface PatientContextCardProps {
  readonly patient: PatientSummary | null;
  readonly onPress: () => void;
}

export function PatientContextCard({ patient, onPress }: PatientContextCardProps) {
  const theme = useAppTheme();
  const ability = patient?.abilityLevel
    ? `${abilityLevelLabels[patient.abilityLevel]}（治疗师评定）`
    : '待专业评估';

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="选择患者" onPress={onPress}>
      <AppCard className="min-h-[82px] flex-row items-center gap-3 p-4">
        <View className="size-10 items-center justify-center rounded-full bg-surface-secondary">
          {patient ? (
            <AppText>{patient.patientCode.slice(-2)}</AppText>
          ) : (
            <UserRoundPlus color={theme.muted} size={20} />
          )}
        </View>
        <View className="flex-1 gap-1">
          <AppText className="font-medium">{patient?.patientCode ?? '建立患者档案'}</AppText>
          <AppText className="text-muted" variant="meta">
            {patient
              ? `${affectedSideLabels[patient.affectedSide]} · ${ability}`
              : '先记录基本资料，再开始观察'}
          </AppText>
        </View>
        <ChevronRight color={theme.muted} size={20} />
      </AppCard>
    </Pressable>
  );
}
