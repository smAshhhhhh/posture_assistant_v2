import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import { Camera } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import type { CameraPermissionGateway } from '@/domain/capture/cameraPermission';
import { getCaptureFeedback } from '@/domain/capture/captureFeedback';
import type { CaptureContext, CaptureSession } from '@/domain/capture/captureSession';
import type { PoseCameraGateway, PoseCameraPreviewProps } from '@/domain/capture/poseCamera';
import { getRequiredLandmarks } from '@/domain/capture/requiredLandmarks';
import { affectedSideLabels } from '@/domain/patients/types';
import type { PatientProfile } from '@/domain/patients/patientRecord';
import { isAngleObservationTask } from '@/domain/observations/angleProtocols';
import type { PoseRecording } from '@/domain/observations/poseRecording';
import type { RehabTask } from '@/domain/tasks/taskCatalog';
import type { AppPreferences } from '@/domain/settings/appPreferences';
import { getTaskInstructions } from '@/domain/tasks/taskInstructions';
import { layoutTokens } from '@/shared/theme/tokens';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppButton } from '@/shared/ui/AppButton';
import { useConfirmAction } from '@/shared/ui/AppConfirmationProvider';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { CameraPermissionBadge } from '../components/CameraPermissionBadge';
import { CameraPermissionCard } from '../components/CameraPermissionCard';
import { CaptureAssistanceCard } from '../components/CaptureAssistanceCard';
import { CaptureControls } from '../components/CaptureControls';
import { CaptureFeedbackCard } from '../components/CaptureFeedbackCard';
import { CaptureResultNotice } from '../components/CaptureResultNotice';
import { CaptureStartCard } from '../components/CaptureStartCard';
import { CaptureTimerCard } from '../components/CaptureTimerCard';
import { useCameraPermission } from '../hooks/useCameraPermission';
import { useCaptureFlow } from '../hooks/useCaptureFlow';

interface CapturePreparationScreenProps {
  readonly patient: PatientProfile;
  readonly task: RehabTask;
  readonly permissionGateway: CameraPermissionGateway;
  readonly poseGateway: PoseCameraGateway;
  readonly CameraPreview: ComponentType<PoseCameraPreviewProps>;
  readonly canSaveObservation: boolean;
  readonly preferences: AppPreferences;
  readonly onBack: () => void;
  readonly onReview: (
    session: CaptureSession,
    recording: PoseRecording,
    hasAssistance: boolean,
  ) => void;
}

export function CapturePreparationScreen({
  patient,
  task,
  permissionGateway,
  poseGateway,
  CameraPreview,
  canSaveObservation,
  preferences,
  onBack,
  onReview,
}: CapturePreparationScreenProps) {
  const confirmAction = useConfirmAction();
  const theme = useAppTheme();
  const isFocused = useIsFocused();
  const camera = useCameraPermission(permissionGateway);
  const [hasAssistance, setHasAssistance] = useState(preferences.defaultAssistance);
  const [hasSafetyConfirmation, setHasSafetyConfirmation] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [reviewRecording, setReviewRecording] = useState<PoseRecording | null>(null);
  const [canDiscard, setCanDiscard] = useState(false);
  const reading = useRef(false);
  const mounted = useRef(true);
  const hasNavigated = useRef(false);
  const shouldRecord = isAngleObservationTask(task.id);
  const context: CaptureContext = useMemo(
    () => ({
      patientId: patient.id,
      taskId: task.id,
      affectedSide: patient.affectedSide,
    }),
    [patient, task],
  );
  const requiredLandmarks = useMemo(
    () => getRequiredLandmarks(task.id, patient.affectedSide),
    [patient.affectedSide, task.id],
  );
  const flow = useCaptureFlow({
    context,
    permission: camera.permission,
    isFocused,
    gateway: poseGateway,
    hasSafetyConfirmation,
    shouldRecord,
    canSaveObservation,
  });
  const instructions = getTaskInstructions(task.id, patient.affectedSide);
  const isCapturing = flow.session.phase === 'capturing';
  const isPaused = flow.session.phase === 'paused';
  const hasFinished = flow.session.phase === 'finished' || flow.session.phase === 'stopped_safety';
  const feedback = getCaptureFeedback(flow.session, flow.camera, flow.isPreviewActive);

  const review = async () => {
    if (reading.current || !hasFinished || !poseGateway.finishRecording) return;
    reading.current = true;
    setIsReading(true);
    setReadError(null);
    try {
      const recording = await poseGateway.finishRecording();
      if (mounted.current) setReviewRecording(recording);
    } catch {
      if (mounted.current) setReadError('无法读取本次关键点数据，请重试。');
    } finally {
      reading.current = false;
      if (mounted.current) setIsReading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!hasNavigated.current) {
        void poseGateway
          .stop()
          .then(() => poseGateway.discardRecording?.())
          .catch(() => undefined);
      }
    };
  }, [poseGateway]);
  usePreventRemove(
    !canDiscard &&
      !reviewRecording &&
      (isCapturing || isPaused || flow.isStarting || (hasFinished && shouldRecord)),
    () => {
      if (reading.current || flow.isStarting || flow.isReleasing) return;
      if (hasFinished) {
        confirmAction({
          title: '放弃本次观察？',
          description: '采集数据尚未保存，返回后将丢失。',
          cancelLabel: '继续查看',
          confirmLabel: '放弃并返回',
          isDestructive: true,
          onConfirm: () => {
            if (reading.current) return;
            reading.current = true;
            void poseGateway
              .discardRecording?.()
              .then(
                () => {
                  if (mounted.current) setCanDiscard(true);
                },
                () => {
                  if (mounted.current) setReadError('未能清理本次视频，请重试放弃。');
                },
              )
              .finally(() => {
                reading.current = false;
              });
          },
        });
        return;
      }
      confirmAction({
        title: '结束本次观察？',
        description: '结束后停止相机和姿态识别，可在当前页面确认并保存。',
        cancelLabel: '继续观察',
        confirmLabel: '结束观察',
        isDestructive: true,
        onConfirm: () => flow.stop('finish'),
      });
    },
  );
  useEffect(() => {
    if (hasNavigated.current) return;
    if (reviewRecording) {
      hasNavigated.current = true;
      onReview(flow.session, reviewRecording, hasAssistance);
    } else if (canDiscard) {
      hasNavigated.current = true;
      onBack();
    }
  }, [canDiscard, flow.session, hasAssistance, onBack, onReview, reviewRecording]);

  return (
    <ScreenLayout
      scrollResetKey={
        hasFinished ? 'finished' : isCapturing || isPaused ? 'capturing' : 'preparing'
      }
      footer={
        isCapturing || isPaused ? (
          <CaptureControls
            phase={flow.session.phase}
            canBegin={flow.canBegin}
            isStarting={flow.isStarting}
            onBegin={flow.begin}
            onStop={flow.stop}
          />
        ) : null
      }
      hasTabBar={false}
      header={
        <AppHeader
          onBack={onBack}
          title={hasFinished ? '观察结束' : isCapturing || isPaused ? '动作采集' : '采集准备'}
        />
      }
    >
      <AppText className="text-muted">
        {task.name} · {patient.patientCode} · {affectedSideLabels[patient.affectedSide]}
      </AppText>
      {hasFinished ? (
        <CaptureResultNotice
          isReleasing={flow.isReleasing}
          releaseError={flow.releaseError}
          session={flow.session}
          canReview={shouldRecord}
          isReading={isReading}
          onReview={() => void review()}
          onBack={onBack}
          onRetryRelease={() => void flow.retryRelease()}
        />
      ) : (
        <>
          <AppCardStack>
            <View className="gap-2">
              <CameraPermissionBadge permission={camera.permission} />
              <View
                className="w-full overflow-hidden rounded-[24px] bg-surface"
                style={{ aspectRatio: layoutTokens.videoAspectRatio }}
              >
                {poseGateway.isAvailable && flow.isPreviewActive ? (
                  <CameraPreview
                    active
                    showSkeleton={preferences.showSkeleton}
                    requiredLandmarks={requiredLandmarks}
                    onStatus={flow.onCameraStatus}
                  />
                ) : (
                  <View className="flex-1 items-center justify-center gap-3 p-4">
                    <Camera color={theme.muted} size={32} />
                    <AppText className="text-center">
                      {isPaused ? '采集已暂停' : '相机预览未开启'}
                    </AppText>
                  </View>
                )}
              </View>
            </View>
            {isCapturing || isPaused ? (
              <>
                <CaptureFeedbackCard
                  session={flow.session}
                  camera={flow.camera}
                  isPreviewActive={flow.isPreviewActive}
                  showCaptureHints={preferences.showCaptureHints}
                />
                <CaptureTimerCard
                  phase={flow.session.phase}
                  durationMs={flow.durationMs}
                  hasAssistance={hasAssistance}
                />
              </>
            ) : null}
          </AppCardStack>
          {!isCapturing && !isPaused ? (
            <>
              {preferences.showCaptureHints ? <AppText>{instructions.framing}</AppText> : null}
              {instructions.measurementNotice ? (
                <AppText>{instructions.measurementNotice}</AppText>
              ) : null}
              {flow.camera.status === 'error' ? <AppNotice>{feedback.message}</AppNotice> : null}
            </>
          ) : null}
          {!isCapturing &&
          (!isPaused || camera.permission !== 'granted' || camera.error !== null) ? (
            <AppCardStack>
              <CameraPermissionCard
                error={camera.error}
                isBusy={camera.isBusy}
                onOpenSettings={() => void camera.openSettings()}
                onRequest={() => void camera.request()}
                permission={camera.permission}
              />
              {!isPaused ? (
                <CaptureAssistanceCard
                  hasAssistance={hasAssistance}
                  isDisabled={flow.isStarting}
                  onChange={setHasAssistance}
                />
              ) : null}
            </AppCardStack>
          ) : null}
          {flow.releaseError ? (
            <View className="gap-3">
              <AppNotice>{flow.releaseError}</AppNotice>
              <AppButton
                isDisabled={flow.isReleasing}
                onPress={() => void flow.retryRelease()}
                variant="secondary"
              >
                重试释放相机
              </AppButton>
            </View>
          ) : null}
          <AppText className="text-muted" variant="caption">
            {poseGateway.isAvailable
              ? shouldRecord
                ? '本次会录制无声原始视频，结束确认后随观察记录保存到本机，可在记录中回放。'
                : '此任务的运动分析、录像与记录保存将在后续阶段接入。'
              : '此安装包尚未包含相机模块，请更新安装包后使用。'}
          </AppText>
        </>
      )}
      {shouldRecord && (!poseGateway.canRecord || !poseGateway.canRecordVideo) ? (
        <AppNotice status="warning">请重新构建安装包，加载 4:3 视频与关键点记录能力。</AppNotice>
      ) : null}
      {shouldRecord && !canSaveObservation ? (
        <AppNotice status="warning">请重新构建安装包，加载此任务的报告存储能力。</AppNotice>
      ) : null}
      {flow.recordingError ? <AppNotice>{flow.recordingError}</AppNotice> : null}
      {isReading ? <AppLoading>正在读取采集数据…</AppLoading> : null}
      {readError ? <AppNotice>{readError}</AppNotice> : null}
      {flow.session.phase === 'preparing' ? (
        <CaptureStartCard
          task={task}
          patient={patient}
          isConfirmed={hasSafetyConfirmation}
          isStarting={flow.isStarting}
          onConfirm={setHasSafetyConfirmation}
          onBegin={() => void flow.begin()}
        />
      ) : null}
    </ScreenLayout>
  );
}
