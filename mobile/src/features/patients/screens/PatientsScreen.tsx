import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { abilityLevelLabels, affectedSideLabels } from '@/domain/patients/types';
import type { PatientSummary } from '@/domain/patients/types';
import { formatDateTime } from '@/shared/lib/formatDateTime';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppButton } from '@/shared/ui/AppButton';
import { AppAvatar } from '@/shared/ui/AppAvatar';
import { AppCard } from '@/shared/ui/AppCard';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppPressable } from '@/shared/ui/AppPressable';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppText } from '@/shared/ui/AppText';
import { AppTextField } from '@/shared/ui/AppTextField';
import { AppTag } from '@/shared/ui/AppTag';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface PatientsScreenProps {
  readonly patients: readonly PatientSummary[];
  readonly onCreatePatient: () => void;
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly onRefresh: () => void;
  readonly onOpenPatient: (patientId: string) => void;
}

export function PatientsScreen({
  patients,
  onCreatePatient,
  status,
  error,
  onRefresh,
  onOpenPatient,
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
        <AppTextField
          label="搜索患者编号"
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setSearch}
          placeholder="输入患者编号"
          value={search}
        />
      ) : null}
      {status === 'loading' ? <AppLoading>正在读取本机档案…</AppLoading> : null}
      {error ? (
        <>
          <AppNotice>{error}</AppNotice>
          <AppButton onPress={onRefresh} variant="secondary">
            重新读取
          </AppButton>
        </>
      ) : null}
      {filteredPatients.length > 0 ? (
        <View className="gap-3">
          <AppText className="text-muted" variant="caption">
            {search.trim() ? '搜索结果' : '患者档案'}
          </AppText>
          <AppCardStack>
            {filteredPatients.map((patient) => (
              <AppPressable
                key={patient.id}
                accessibilityLabel={`查看患者 ${patient.patientCode} 的档案`}
                accessibilityRole="button"
                className="rounded-[24px]"
                onPress={() => onOpenPatient(patient.id)}
              >
                <AppCard className="min-h-[82px] flex-row items-center gap-3">
                  <AppAvatar label={patient.patientCode} imageUri={patient.photoUri} size="md" />
                  <View className="min-w-0 flex-1 gap-1">
                    <AppText className="font-medium">{patient.patientCode}</AppText>
                    <View className="flex-row flex-wrap gap-2">
                      <AppTag label={affectedSideLabels[patient.affectedSide]} />
                      <AppTag
                        label={
                          patient.abilityLevel
                            ? `${abilityLevelLabels[patient.abilityLevel]}（专业评定）`
                            : '待专业评估'
                        }
                      />
                    </View>
                    <AppText className="text-muted" variant="meta">
                      {formatDateTime(patient.lastObservedAt)}
                    </AppText>
                  </View>
                  <ChevronRight color={theme.muted} size={20} accessible={false} />
                </AppCard>
              </AppPressable>
            ))}
          </AppCardStack>
        </View>
      ) : status === 'ready' ? (
        <EmptyState
          title={patients.length === 0 ? '建立第一位患者的档案' : '没有找到这位患者'}
          description={
            patients.length === 0
              ? '使用患者编号管理资料，档案和专业评估保存在本机。'
              : '请检查编号，或清空搜索后查看全部患者。'
          }
        />
      ) : null}
      <AppText className="text-muted" variant="caption">
        能力等级由治疗师评定；档案只保存在本机。
      </AppText>
      <AppButton isDisabled={status !== 'ready'} onPress={onCreatePatient}>
        新建患者档案
      </AppButton>
    </ScreenLayout>
  );
}
