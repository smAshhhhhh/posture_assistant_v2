import { usePreventRemove } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { CaptureSession } from '@/domain/capture/captureSession';
import { safetyStopReasonLabels } from '@/domain/capture/captureSession';
import { analyzeObservation } from '@/domain/observations/observationAnalysis';
import { isAngleObservationTask } from '@/domain/observations/angleProtocols';
import {
  createObservationReport,
  getObservationErrorMessage,
} from '@/domain/observations/observationReport';
import type {
  ConfirmedTaskStatus,
  ObservationRepository,
} from '@/domain/observations/observationReport';
import type { PoseRecording } from '@/domain/observations/poseRecording';
import type { PatientProfile } from '@/domain/patients/patientRecord';
import { rehabTasks } from '@/domain/tasks/taskCatalog';
import { AppButton } from '@/shared/ui/AppButton';
import { useConfirmAction } from '@/shared/ui/AppConfirmationProvider';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppRadioGroup } from '@/shared/ui/AppRadioGroup';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { ObservationReportContent } from '../components/ObservationReportContent';

export interface PendingObservation {
  readonly patient: PatientProfile;
  readonly session: CaptureSession;
  readonly recording: PoseRecording;
  readonly hasAssistance: boolean;
}

interface ObservationReviewScreenProps {
  readonly pending: PendingObservation;
  readonly repository: ObservationRepository;
  readonly onBack: () => void;
  readonly onDiscard: () => void;
  readonly onSaved: (id: string) => void;
  readonly onDiscardVideo: () => Promise<void>;
}

export function ObservationReviewScreen({
  pending,
  repository,
  onBack,
  onDiscard,
  onSaved,
  onDiscardVideo,
}: ObservationReviewScreenProps) {
  const confirmAction = useConfirmAction();
  const { patient, session, recording, hasAssistance } = pending;
  const [status, setStatus] = useState<ConfirmedTaskStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [canDiscard, setCanDiscard] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const hasNavigated = useRef(false);
  const taskId = session.context.taskId;
  const task = rehabTasks.find((item) => item.id === taskId);
  const canSave = isAngleObservationTask(taskId) && repository.supportsTask(taskId);
  const analysis = useMemo(
    () =>
      isAngleObservationTask(taskId)
        ? analyzeObservation(recording, patient.affectedSide, taskId)
        : null,
    [recording, patient.affectedSide, taskId],
  );
  const isSafetyStop = session.phase === 'stopped_safety';
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (savedId && !hasNavigated.current) {
      hasNavigated.current = true;
      onSaved(savedId);
    }
  }, [onSaved, savedId]);
  usePreventRemove(!savedId && !canDiscard, () => {
    if (saving.current || isDiscarding) return;
    confirmAction({
      title: '放弃本次观察？',
      description: '当前采集数据尚未保存。',
      cancelLabel: '继续查看',
      confirmLabel: '放弃并返回',
      isDestructive: true,
      onConfirm: () => {
        if (saving.current || isDiscarding) return;
        setIsDiscarding(true);
        void onDiscardVideo()
          .then(
            () => {
              if (mounted.current) setCanDiscard(true);
            },
            () => {
              if (mounted.current) setError('未能清理本次视频，请重试放弃。');
            },
          )
          .finally(() => {
            if (mounted.current) setIsDiscarding(false);
          });
      },
    });
  });
  useEffect(() => {
    if (canDiscard && !hasNavigated.current) {
      hasNavigated.current = true;
      onDiscard();
    }
  }, [canDiscard, onDiscard]);
  const save = async () => {
    if (saving.current || savedId || isDiscarding) return;
    if (!status && !isSafetyStop) {
      setStatusError('请先确认任务完成情况。');
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const report = createObservationReport(patient, session, recording, status, hasAssistance);
      const saved = await repository.save(report, recording);
      if (mounted.current) setSavedId(saved.id);
    } catch (failure) {
      if (mounted.current) setError(getObservationErrorMessage(failure));
    } finally {
      saving.current = false;
      if (mounted.current) setIsSaving(false);
    }
  };
  if (!analysis || !task || !isAngleObservationTask(taskId)) {
    return (
      <ScreenLayout hasTabBar={false} header={<AppHeader title="观察报告" onBack={onBack} />}>
        <AppNotice status="warning">此任务尚未接入报告分析。</AppNotice>
      </ScreenLayout>
    );
  }
  return (
    <ScreenLayout
      hasTabBar={false}
      header={<AppHeader title="观察报告" onBack={onBack} />}
      footer={
        <AppButton isDisabled={isSaving || isDiscarding || !canSave} onPress={() => void save()}>
          {isSaving ? '正在保存…' : '保存观察记录'}
        </AppButton>
      }
    >
      <AppText variant="title">{task.name}</AppText>
      <AppText className="text-muted">
        {patient.patientCode} · {patient.affectedSide === 'left' ? '左侧' : '右侧'} · 尚未保存
      </AppText>
      <ObservationReportContent
        taskId={taskId}
        analysis={analysis}
        durationMs={recording.durationMs}
        taskStatus={isSafetyStop ? 'stopped_safety' : status}
        hasAssistance={hasAssistance}
      />
      {recording.video ? (
        <AppText>
          原始视频：{recording.video.segments.length} 段无声录像，将随记录保存在本机。
          {recording.video.error || recording.video.segments.length === 0
            ? '录像曾中断或未生成可用片段；保存仅保留已成功录制的内容。'
            : ''}
        </AppText>
      ) : null}
      {recording.isTruncated ? (
        <AppNotice status="warning">
          采集数据超过当前容量限制，本次指标无效，请缩短观察时长后重新采集。
        </AppNotice>
      ) : null}
      <AppText variant="caption" className="text-muted">
        未保存数据仅保留在本次会话，关闭应用会丢失。
      </AppText>
      {!isSafetyStop ? (
        <AppRadioGroup
          label="根据现场观察确认任务状态"
          description="识别失败只影响采集质量，不代表患者无法完成。"
          isRequired
          value={status}
          isDisabled={isSaving || isDiscarding}
          error={statusError ?? undefined}
          onChange={(next) => {
            setStatus(next);
            setStatusError(null);
          }}
          options={[
            {
              value: hasAssistance ? 'assisted' : 'completed',
              label: hasAssistance ? '辅助下完成' : '已完成',
            },
            { value: 'partial', label: '部分完成' },
            { value: 'unable', label: '无法完成' },
          ]}
        />
      ) : (
        <AppText>
          安全停止原因：
          {session.safetyStopReason ? safetyStopReasonLabels[session.safetyStopReason] : '尚未补充'}
        </AppText>
      )}
      {!canSave ? (
        <AppNotice status="warning">请重新构建安装包，加载此任务的报告存储能力。</AppNotice>
      ) : null}
      {error ? <AppNotice>{error}</AppNotice> : null}
    </ScreenLayout>
  );
}
