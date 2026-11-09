import { UsersRound } from 'lucide-react-native';
import { useState } from 'react';

import { abilityLevelLabels, affectedSideLabels } from '@/domain/patients/types';
import type { PatientSummary } from '@/domain/patients/types';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppSearchSelect } from '@/shared/ui/AppSearchSelect';
import { AppAvatar } from '@/shared/ui/AppAvatar';

interface HistoryPatientSelectProps {
  readonly patients: readonly PatientSummary[];
  readonly patientId: string | null;
  readonly onChange: (patientId: string | null) => void;
}

export function HistoryPatientSelect({ patients, patientId, onChange }: HistoryPatientSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useAppTheme();
  const allOption = {
    value: 'all',
    label: '全部',
    description: '查看所有患者的观察记录',
    startContent: <UsersRound color={theme.muted} size={20} />,
  };

  return (
    <AppSearchSelect
      label="选择患者"
      searchLabel="搜索患者编号"
      value={patientId ?? 'all'}
      options={patients.map((patient) => {
        const ability = patient.abilityLevel
          ? abilityLevelLabels[patient.abilityLevel]
          : '待专业评估';
        return {
          value: patient.id,
          label: patient.patientCode,
          description: `${affectedSideLabels[patient.affectedSide]} · ${ability}`,
          triggerDescription:
            `${affectedSideLabels[patient.affectedSide]} · ${ability}` +
            (patient.abilityLevel ? '（治疗师评定）' : ''),
          startContent: <AppAvatar label={patient.patientCode} imageUri={patient.photoUri} />,
        };
      })}
      fixedOptions={[allOption]}
      placeholder={allOption}
      emptyContent={null}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onChange={(value) => onChange(value === 'all' ? null : value)}
    />
  );
}
