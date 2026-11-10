import { View } from 'react-native';

import type { ObservationSummary } from '@/domain/observations/types';
import { captureQualityLabels, taskStatusLabels } from '@/domain/observations/types';
import type { PatientProfile } from '@/domain/patients/patientRecord';
import { abilityLevelLabels, affectedSideLabels } from '@/domain/patients/types';
import { AppButton } from '@/shared/ui/AppButton';
import { AppAvatar } from '@/shared/ui/AppAvatar';
import { AppCard } from '@/shared/ui/AppCard';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppText } from '@/shared/ui/AppText';
import { AppSummaryCard } from '@/shared/ui/AppSummaryCard';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';
import { formatDateTime } from '@/shared/lib/formatDateTime';

interface PatientProfileScreenProps {
  readonly patient: PatientProfile;
  readonly observations: readonly ObservationSummary[];
  readonly historyStatus: 'loading' | 'ready' | 'error';
  readonly onRetryHistory: () => void;
  readonly onOpenObservation: (id: string) => void;
  readonly onBack: () => void;
  readonly onEdit: () => void;
  readonly onAssessments: () => void;
  readonly onManageData: () => void;
}

export function PatientProfileScreen({
  patient,
  observations,
  historyStatus,
  onRetryHistory,
  onOpenObservation,
  onBack,
  onEdit,
  onAssessments,
  onManageData,
}: PatientProfileScreenProps) {
  return (
    <ScreenLayout hasTabBar={false} header={<AppHeader title="患者档案" onBack={onBack} />}>
      <View className="flex-row items-center gap-4">
        <AppAvatar label={patient.patientCode} imageUri={patient.photoUri} size="lg" />
        <View className="min-w-0 flex-1 gap-2">
          <AppText variant="title">{patient.patientCode}</AppText>
          <AppText className="text-muted">
            去标识患者编号 · 建档于{' '}
            {new Intl.DateTimeFormat('zh-CN', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
            }).format(new Date(patient.createdAt))}
          </AppText>
        </View>
      </View>
      <AppCard className="gap-4">
        <AppText>患侧：{affectedSideLabels[patient.affectedSide]}</AppText>
        <AppText>年龄：{patient.ageYears === null ? '未填写' : `${patient.ageYears} 岁`}</AppText>
        <AppText>发病日期：{patient.onsetDate ?? '未填写'}</AppText>
        <AppText>
          能力等级：
          {patient.abilityLevel
            ? `${abilityLevelLabels[patient.abilityLevel]}（专业评定）`
            : '待专业评定'}
        </AppText>
        {patient.abilityLevel ? (
          <AppText className="text-muted">
            评定者 {patient.abilityAssessor} · {patient.abilityAssessedOn}
          </AppText>
        ) : null}
      </AppCard>
      <AppButton variant="secondary" onPress={onEdit}>
        编辑患者资料
      </AppButton>
      <AppButton variant="secondary" onPress={onAssessments}>
        专业评估记录
      </AppButton>
      <View className="gap-3">
        <AppText variant="section">最近观察</AppText>
        {historyStatus === 'loading' ? <AppLoading>正在读取观察记录…</AppLoading> : null}
        {historyStatus === 'error' ? (
          <AppButton variant="secondary" onPress={onRetryHistory}>
            重新读取观察记录
          </AppButton>
        ) : null}
        {historyStatus === 'ready' || observations.length > 0 ? (
          <AppCardStack>
            {historyStatus === 'ready' && observations.length === 0 ? (
              <AppCard>
                <AppText className="text-muted">尚无已保存的观察记录。</AppText>
              </AppCard>
            ) : null}
            {observations.slice(0, 3).map((observation) => {
              const observedAt = formatDateTime(observation.observedAt);
              const quality = captureQualityLabels[observation.captureQuality];
              const taskStatus = taskStatusLabels[observation.taskStatus];
              const repetitionPrefix = observation.taskId === 'short_walk' ? '患侧周期 ' : '';
              const repetitionUnit = observation.taskId === 'march_in_place' ? '步' : '次';
              const repetitions = `${repetitionPrefix}${observation.repetitions ?? '—'} ${repetitionUnit}`;
              const duration = `${(observation.durationMs / 1_000).toFixed(1)} 秒`;
              const summary = `${taskStatus} · ${repetitions} · ${duration}`;

              return (
                <AppSummaryCard
                  key={observation.id}
                  title={observation.taskName}
                  description={observedAt}
                  summary={summary}
                  tagLabel={quality}
                  tagColor={
                    observation.captureQuality === 'valid'
                      ? 'success'
                      : observation.captureQuality === 'degraded'
                        ? 'warning'
                        : 'danger'
                  }
                  accessibilityLabel={[observation.taskName, observedAt, quality, summary].join(
                    '，',
                  )}
                  accessibilityHint="打开观察报告"
                  onPress={() => onOpenObservation(observation.id)}
                />
              );
            })}
          </AppCardStack>
        ) : null}
      </View>
      <AppText variant="caption" className="text-muted">
        患者授权已记录 · 资料保存在本机 · 观察视频随记录本地保存
      </AppText>
      <AppButton variant="secondary" onPress={onManageData}>
        导出或删除患者资料
      </AppButton>
    </ScreenLayout>
  );
}
