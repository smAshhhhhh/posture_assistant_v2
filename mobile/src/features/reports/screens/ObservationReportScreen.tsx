import { getAngleAnalysis } from '@/domain/observations/taskAnalysis';
import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';

import { safetyStopReasonLabels } from '@/domain/capture/legacyCaptureStatus';
import type { ObservationVideoPlayerProps } from '@/domain/observations/observationVideo';

import { getObservationErrorMessage } from '@/domain/observations/observationReport';
import type {
  ObservationReport,
  ObservationRepository,
} from '@/domain/observations/observationReport';
import { formatDateTime } from '@/shared/lib/formatDateTime';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { ObservationReportContent } from '../components/ObservationReportContent';
import { ObservationVideoCard } from '../components/ObservationVideoCard';

interface ObservationReportScreenProps {
  readonly id: string;
  readonly repository: ObservationRepository;
  readonly onBack: () => void;
  readonly onCompare: () => void;
  readonly onManageData: () => void;
  readonly VideoPlayer: ComponentType<ObservationVideoPlayerProps>;
}

export function ObservationReportScreen({
  id,
  repository,
  onBack,
  onCompare,
  onManageData,
  VideoPlayer,
}: ObservationReportScreenProps) {
  const [report, setReport] = useState<ObservationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void repository
      .get(id)
      .then((saved) => {
        if (active) setReport(saved);
      })
      .catch((failure: unknown) => {
        if (active) setError(getObservationErrorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [id, repository, attempt]);
  return (
    <ScreenLayout hasTabBar={false} header={<AppHeader title="观察报告" onBack={onBack} />}>
      {report ? (
        <>
          <AppText variant="title">{report.taskName}</AppText>
          <AppText className="text-muted">
            {report.patientCode} · {formatDateTime(report.observedAt)} · 已保存
          </AppText>
          <AppCardStack>
            <ObservationVideoCard key={id} id={id} repository={repository} Player={VideoPlayer} />
            <ObservationReportContent
              taskId={report.taskId}
              analysis={getAngleAnalysis(report.taskAnalysis)}
              durationMs={report.durationMs}
              taskStatus={report.taskStatus}
              hasAssistance={report.assistance !== 'none'}
            />
          </AppCardStack>
          {report.taskStatus === 'stopped_safety' ? (
            <AppText>
              安全停止原因：
              {report.legacySafetyStopReason
                ? safetyStopReasonLabels[report.legacySafetyStopReason]
                : '尚未补充'}
            </AppText>
          ) : null}
          <AppText variant="caption" className="text-muted">
            协议 {report.protocolVersion} · 算法 {report.analysisVersion} · 模型{' '}
            {report.modelVersion}
          </AppText>
          <AppButton variant="secondary" onPress={onCompare}>
            历史对比
          </AppButton>
        </>
      ) : error ? (
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
      ) : (
        <AppLoading>正在读取本机报告…</AppLoading>
      )}
      <AppButton variant="secondary" onPress={onManageData}>
        导出或删除此记录
      </AppButton>
    </ScreenLayout>
  );
}
