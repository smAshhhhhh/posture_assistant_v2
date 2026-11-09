import { useState } from 'react';
import { View } from 'react-native';

import {
  filterObservationHistory,
  validateHistoryDates,
} from '@/domain/observations/observationHistory';
import type { HistoryFilter } from '@/domain/observations/observationHistory';
import { captureQualityLabels, taskStatusLabels } from '@/domain/observations/types';
import type { ObservationSummary } from '@/domain/observations/types';
import { affectedSideLabels } from '@/domain/patients/types';
import type { PatientSummary } from '@/domain/patients/types';
import { rehabTasks } from '@/domain/tasks/taskCatalog';
import { formatDateTime } from '@/shared/lib/formatDateTime';
import { AppCard } from '@/shared/ui/AppCard';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppPressable } from '@/shared/ui/AppPressable';
import { AppButton } from '@/shared/ui/AppButton';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppDatePicker } from '@/shared/ui/AppDatePicker';
import { AppText } from '@/shared/ui/AppText';
import { AppSelect } from '@/shared/ui/AppSelect';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { HistoryPatientSelect } from '../components/HistoryPatientSelect';

interface HistoryScreenProps {
  readonly patient: PatientSummary | null;
  readonly patients: readonly PatientSummary[];
  readonly onManagePatients: () => void;
  readonly observations: readonly ObservationSummary[];
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly onRefresh: () => void;
  readonly onOpenObservation: (id: string) => void;
}

export function HistoryScreen({
  patient,
  patients,
  onManagePatients,
  observations,
  status,
  error,
  onRefresh,
  onOpenObservation,
}: HistoryScreenProps) {
  const [selectedScope, setSelectedScope] = useState('current');
  const [taskId, setTaskId] = useState<HistoryFilter['taskId']>(null);
  const [quality, setQuality] = useState<HistoryFilter['quality']>(null);
  const [from, setFrom] = useState('');
  const [through, setThrough] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const dateError = validateHistoryDates(from, through);
  const effectiveScope =
    selectedScope === 'current' ||
    selectedScope === 'all' ||
    patients.some((item) => item.id === selectedScope)
      ? selectedScope
      : 'current';
  const scopeId =
    effectiveScope === 'current'
      ? (patient?.id ?? null)
      : effectiveScope === 'all'
        ? null
        : effectiveScope;
  const filtered = filterObservationHistory(observations, {
    patientId: scopeId,
    taskId,
    quality,
    status: null,
    side: null,
    from,
    through,
  });
  const qualityOptions = [
    { value: 'all', label: '全部质量' },
    ...Object.entries(captureQualityLabels).map(([value, label]) => ({ value, label })),
  ];
  return (
    <ScreenLayout header={<AppHeader title="历史记录" />}>
      <View className="gap-2">
        <AppText accessibilityRole="header" variant="title">
          观察记录
        </AppText>
        <AppText className="text-muted" variant="caption">
          筛选后 {filtered.length} 条 · 本机共 {observations.length} 条
        </AppText>
        <AppText variant="caption">
          {scopeId
            ? `患者 ${patients.find((item) => item.id === scopeId)?.patientCode ?? '未选择'}`
            : '全部患者'}
          {taskId ? ` · ${rehabTasks.find((task) => task.id === taskId)?.name}` : ' · 全部任务'}
          {quality ? ` · ${captureQualityLabels[quality]}` : ''}
          {from || through ? ` · ${from || '不限'} 至 ${through || '不限'}` : ''}
        </AppText>
      </View>
      <AppButton variant="secondary" onPress={() => setShowFilters((current) => !current)}>
        {showFilters ? '收起筛选' : '筛选记录'}
      </AppButton>
      {patients.length > 0 && showFilters ? (
        <View className="gap-3">
          <HistoryPatientSelect
            patients={patients}
            patientId={scopeId}
            onChange={(patientId) => setSelectedScope(patientId ?? 'all')}
          />
          <AppSelect
            label="观察任务"
            value={taskId ?? 'all'}
            options={[
              { value: 'all', label: '全部任务' },
              ...rehabTasks.map((task) => ({ value: task.id, label: task.name })),
            ]}
            onChange={(value) =>
              setTaskId(rehabTasks.find((task) => task.id === value)?.id ?? null)
            }
          />
          <AppSelect
            label="采集质量"
            value={quality ?? 'all'}
            options={qualityOptions}
            onChange={(value) =>
              setQuality(
                value === 'valid' || value === 'degraded' || value === 'invalid_capture'
                  ? value
                  : null,
              )
            }
          />
          <AppDatePicker
            label="开始日期"
            value={from}
            maximumDate={through || '9999-12-31'}
            onChange={setFrom}
            placeholder="不限开始日期"
          />
          <AppDatePicker
            label="结束日期"
            description="包含当天的全部记录。"
            error={dateError ?? undefined}
            value={through}
            minimumDate={from || '1900-01-01'}
            onChange={setThrough}
            placeholder="不限结束日期"
          />
          <AppButton
            variant="secondary"
            onPress={() => {
              setSelectedScope('all');
              setTaskId(null);
              setQuality(null);
              setFrom('');
              setThrough('');
            }}
          >
            重置筛选
          </AppButton>
        </View>
      ) : patients.length === 0 ? (
        <AppButton onPress={onManagePatients}>建立患者档案</AppButton>
      ) : null}
      {status === 'loading' ? <AppLoading>正在读取观察记录…</AppLoading> : null}
      {error ? (
        <>
          <AppNotice>{error}</AppNotice>
          <AppButton onPress={onRefresh} variant="secondary">
            重新读取
          </AppButton>
        </>
      ) : null}
      {filtered.length === 0 && status === 'ready' && !dateError ? (
        <EmptyState
          title={observations.length === 0 ? '还没有采集记录' : '没有符合条件的记录'}
          description={
            observations.length === 0
              ? '完成并保存一次观察后，可以在这里查看报告和历史记录。'
              : '调整患者、任务、日期或质量条件后重试。'
          }
        />
      ) : filtered.length > 0 ? (
        <AppCardStack>
          {filtered.map((observation) => (
            <AppPressable
              className="rounded-[24px]"
              key={observation.id}
              accessibilityRole="button"
              accessibilityLabel={`查看${observation.taskName}观察报告`}
              onPress={() => onOpenObservation(observation.id)}
            >
              <AppCard className="gap-2">
                <AppText className="font-medium">{observation.taskName}</AppText>
                <AppText variant="caption">
                  {patients.find((item) => item.id === observation.patientId)?.patientCode ??
                    '患者档案'}
                </AppText>
                <AppText className="text-muted" variant="caption">
                  {formatDateTime(observation.observedAt)} ·{' '}
                  {affectedSideLabels[observation.affectedSide]}
                </AppText>
                <AppText className="text-muted" variant="caption">
                  {taskStatusLabels[observation.taskStatus]} ·{' '}
                  {captureQualityLabels[observation.captureQuality]}
                </AppText>
                <AppText variant="caption">
                  {observation.taskId === 'short_walk' ? '患侧周期 ' : ''}
                  {observation.repetitions === null ? '—' : observation.repetitions}{' '}
                  {observation.taskId === 'march_in_place' ? '步' : '次'} ·{' '}
                  {observation.durationMs / 1_000} 秒
                </AppText>
              </AppCard>
            </AppPressable>
          ))}
        </AppCardStack>
      ) : null}
      <AppText className="text-muted" variant="caption">
        任务状态与采集质量分别记录；质量不足不参与直接对比。
      </AppText>
    </ScreenLayout>
  );
}
