import { Input } from 'heroui-native/input';
import { Check, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { abilityLevelLabels, affectedSideLabels } from '@/domain/patients/types';
import type { PatientSummary } from '@/domain/patients/types';
import { formatDateTime } from '@/shared/lib/formatDateTime';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppText } from '@/shared/ui/AppText';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface PatientsScreenProps {
  readonly patients: readonly PatientSummary[];
  readonly selectedPatientId: string | null;
  readonly onSelectPatient: (patientId: string) => void;
  readonly onCreatePatient: () => void;
}

export function PatientsScreen({
  patients,
  selectedPatientId,
  onSelectPatient,
  onCreatePatient,
}: PatientsScreenProps) {
  const [search, setSearch] = useState('');
  const theme = useAppTheme();
  const filteredPatients = patients.filter((patient) =>
    patient.patientCode.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <ScreenLayout header={<AppHeader title="患者" />}>
      <View className="flex-row items-center justify-between gap-3">
        <AppText accessibilityRole="header" variant="title">
          本机患者
        </AppText>
        <AppText className="text-muted" variant="caption">
          {patients.length} 位
        </AppText>
      </View>
      {patients.length > 0 ? (
        <View className="gap-2">
          <AppText nativeID="patient-search-label" variant="caption">
            搜索患者编号
          </AppText>
          <Input
            accessibilityLabel="搜索患者编号"
            autoCapitalize="characters"
            className="min-h-[52px] rounded-xl"
            onChangeText={setSearch}
            placeholder="输入患者编号"
            value={search}
          />
        </View>
      ) : null}
      {filteredPatients.length > 0 ? (
        <View className="gap-3">
          <AppText className="text-muted" variant="caption">
            {search.trim() ? '搜索结果' : '最近使用'}
          </AppText>
          {filteredPatients.map((patient) => (
            <Pressable
              accessibilityLabel={`选择患者 ${patient.patientCode}`}
              accessibilityRole="button"
              accessibilityState={{ selected: patient.id === selectedPatientId }}
              key={patient.id}
              onPress={() => onSelectPatient(patient.id)}
            >
              <AppCard className="min-h-[82px] flex-row items-center gap-3 p-4">
                <View className="flex-1 gap-1">
                  <AppText className="font-medium">{patient.patientCode}</AppText>
                  <AppText className="text-muted" variant="caption">
                    {affectedSideLabels[patient.affectedSide]} ·{' '}
                    {patient.abilityLevel ? abilityLevelLabels[patient.abilityLevel] : '待专业评估'}
                  </AppText>
                  <AppText className="text-muted" variant="meta">
                    {formatDateTime(patient.lastObservedAt)}
                  </AppText>
                </View>
                {patient.id === selectedPatientId ? (
                  <Check color={theme.accent} size={20} />
                ) : (
                  <ChevronRight color={theme.muted} size={20} />
                )}
              </AppCard>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          title={patients.length === 0 ? '建立第一位患者的档案' : '没有找到这位患者'}
          description={
            patients.length === 0
              ? '使用患者编号管理资料，档案和观察记录保存在本机。'
              : '请检查编号，或清空搜索后查看全部患者。'
          }
        />
      )}
      <AppText className="text-muted" variant="caption">
        能力等级由治疗师评定；档案只保存在本机。
      </AppText>
      <AppButton onPress={onCreatePatient}>新建患者档案</AppButton>
    </ScreenLayout>
  );
}
