import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { getObservationChanges } from '@/domain/observations/observationHistory';
import { getObservationErrorMessage } from '@/domain/observations/observationReport';
import type {
  ObservationReport,
  ObservationRepository,
} from '@/domain/observations/observationReport';
import type { ObservationSummary } from '@/domain/observations/types';
import { captureQualityLabels, taskStatusLabels } from '@/domain/observations/types';
import { formatDateTime } from '@/shared/lib/formatDateTime';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppSelect } from '@/shared/ui/AppSelect';
import { AppText } from '@/shared/ui/AppText';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { CaptureQualityChip } from '../components/CaptureQualityChip';

interface ObservationCompareScreenProps {
  readonly id: string;
  readonly observations: readonly ObservationSummary[];
  readonly repository: ObservationRepository;
  readonly onBack: () => void;
}

export function ObservationCompareScreen({
  id,
  observations,
  repository,
  onBack,
}: ObservationCompareScreenProps) {
  const [base, setBase] = useState<ObservationReport | null>(null);
  const [other, setOther] = useState<ObservationReport | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.all([
      repository.get(id),
      selectedId ? repository.get(selectedId) : Promise.resolve(null),
    ])
      .then(([first, second]) => {
        if (active) {
          setBase(first);
          setOther(second);
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(getObservationErrorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [id, selectedId, repository, attempt]);
  const candidates = observations.filter(
    (item) => item.id !== id && item.patientId === base?.patientId && item.taskId === base.taskId,
  );
  const changes = base && other ? getObservationChanges(base, other) : null;
  const number = (value: number | null) => (value === null ? '—' : value.toFixed(1));

  return (
    <ScreenLayout hasTabBar={false} header={<AppHeader title="同协议对比" onBack={onBack} />}>
      {base ? (
        <>
          <AppText variant="title">{base.taskName}</AppText>
          <AppText>
            {base.patientCode} · 当前记录 {formatDateTime(base.observedAt)}
          </AppText>
          {candidates.length > 0 ? (
            <AppSelect
              label="选择另一条记录"
              value={selectedId}
              options={candidates.map((item) => ({
                value: item.id,
                label: formatDateTime(item.observedAt),
                accessibilityLabel: `${formatDateTime(item.observedAt)}，${captureQualityLabels[item.captureQuality]}`,
                endContent: <CaptureQualityChip quality={item.captureQuality} />,
              }))}
              onChange={(value) => {
                setOther(null);
                setError(null);
                setSelectedId(value);
              }}
            />
          ) : (
            <EmptyState
              title="还没有可选择的同任务记录"
              description="再保存一次该患者的同任务观察后，可在这里核对可比条件。"
            />
          )}
        </>
      ) : !error ? (
        <AppLoading>正在读取记录…</AppLoading>
      ) : null}
      {selectedId && !other && !error ? <AppLoading>正在核对对比条件…</AppLoading> : null}
      {changes && changes.issues.length > 0 ? (
        <AppCard className="gap-3">
          <AppText variant="section">这两条记录不能直接对比</AppText>
          {changes.issues.map((issue) => (
            <AppText key={issue}>{issue}</AppText>
          ))}
        </AppCard>
      ) : changes?.earlier && changes.later ? (
        <View className="gap-6">
          <AppCardStack>
            <AppCard className="gap-2">
              <AppText variant="section">可比条件一致</AppText>
              <AppText>
                较早：{formatDateTime(changes.earlier.observedAt)} ·{' '}
                {taskStatusLabels[changes.earlier.taskStatus]}
              </AppText>
              <AppText>
                较晚：{formatDateTime(changes.later.observedAt)} ·{' '}
                {taskStatusLabels[changes.later.taskStatus]}
              </AppText>
              <AppText variant="caption" className="text-muted">
                同患者、任务、患侧、机位、辅助方式、协议、算法和模型；两次采集均有效。
              </AppText>
            </AppCard>
            {changes.metrics.map((metric) => (
              <AppCard key={metric.label} className="gap-2">
                <AppText variant="section">{metric.label}</AppText>
                <AppText>
                  {number(metric.before)} → {number(metric.after)} {metric.unit}
                </AppText>
                <AppText>
                  较晚减较早：
                  {metric.change === null
                    ? '—'
                    : `${metric.change > 0 ? '+' : ''}${number(metric.change)}`}{' '}
                  {metric.unit}
                </AppText>
              </AppCard>
            ))}
          </AppCardStack>
          <AppText variant="caption" className="text-muted">
            数值差异仅描述两次观察，不代表改善或退步；任务完成情况和采集时长仍需结合现场条件解释。
          </AppText>
        </View>
      ) : null}
      {error ? (
        <>
          <AppNotice>{error}</AppNotice>
          <AppButton
            onPress={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            重新读取
          </AppButton>
        </>
      ) : null}
    </ScreenLayout>
  );
}
