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

import { CameraPermissionCard } from '../components/CameraPermissionCard';
import { CaptureAssistanceCard } from '../components/CaptureAssistanceCard';
import { CaptureControls } from '../components/CaptureControls';
import { CaptureFeedbackCard } from '../components/CaptureFeedbackCard';
import { CaptureGuidanceCard } from '../components/CaptureGuidanceCard';
import { CapturePreviewLabels } from '../components/CapturePreviewLabels';
import { CaptureResultNotice } from '../components/CaptureResultNotice';
import { CaptureStartCard } from '../components/CaptureStartCard';
import { CaptureTimerCard } from '../components/CaptureTimerCard';
import { TaskProtocolCard } from '../components/TaskProtocolCard';
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
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [reviewRecording, setReviewRecording] = useState<PoseRecording | null>(null);
  const [canDiscard, setCanDiscard] = useState(false);
  const reading = useRef(false);
  const mounted = useRef(true);
  const hasNavigated = useRef(false);
  // 同一次观察固定使用进入页面时的模型，暂停恢复也不能改变。
  const [poseModel] = useState(preferences.poseModel);
  const isModelSupported = poseModel === 'lite' || poseGateway.canSelectPoseModel === true;
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
    canSaveObservation,
    canUsePoseModel: isModelSupported,
  });
  const instructions = getTaskInstructions(task.id, patient.affectedSide);
  const isCapturing = flow.session.phase === 'capturing';
  const isPaused = flow.session.phase === 'paused';
  const hasFinished = flow.session.phase === 'finished';
  const feedback = getCaptureFeedback(flow.session, flow.camera, flow.isPreviewActive);
  const previewTitle = [task.name, patient.patientCode].join(' · ');
  const captureTitle = [
    task.name,
    patient.patientCode,
    affectedSideLabels[patient.affectedSide],
  ].join(' · ');

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

  const discard = async () => {
    if (reading.current || flow.isStarting || flow.isReleasing) return;
    reading.current = true;
    setIsDiscarding(true);
    setReadError(null);
    try {
      // 先停止计时并等待录像释放，再删除未保存数据，不触发报告读取。
      if (!(await flow.stop('pause'))) return;
      await poseGateway.discardRecording?.();
      if (mounted.current) setCanDiscard(true);
    } catch {
      if (mounted.current) setReadError('未能清理本次采集数据，请重试退出观察。');
    } finally {
      reading.current = false;
      if (mounted.current) setIsDiscarding(false);
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
    !canDiscard && !reviewRecording && (isCapturing || isPaused || flow.isStarting || hasFinished),
    () => {
      if (reading.current || flow.isStarting || flow.isReleasing) return;
      confirmAction({
        title: hasFinished ? '放弃本次观察？' : '退出本次观察？',
        description: '退出将停止采集并丢弃本次未保存的数据，返回上一页。',
        cancelLabel: hasFinished ? '继续查看' : '继续观察',
        confirmLabel: hasFinished ? '放弃并返回' : '退出观察',
        isDestructive: true,
        onConfirm: () => void discard(),
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
            isDisabled={isDiscarding || flow.isReleasing}
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
      {hasFinished ? <AppText className="text-muted">{captureTitle}</AppText> : null}
      {hasFinished ? (
        <CaptureResultNotice
          isReleasing={flow.isReleasing}
          releaseError={flow.releaseError}
          session={flow.session}
          isReading={isReading || isDiscarding}
          onReview={() => void review()}
          onBack={onBack}
          onRetryRelease={() => void flow.retryRelease()}
        />
      ) : (
        <>
          <AppCardStack>
            <View
              className="w-full overflow-hidden rounded-[24px] bg-surface"
              style={{ position: 'relative', aspectRatio: layoutTokens.videoAspectRatio }}
            >
              {poseGateway.isAvailable && flow.isPreviewActive && isModelSupported ? (
                <CameraPreview
                  active
                  showSkeleton={preferences.showSkeleton}
                  poseModel={poseModel}
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
              <CapturePreviewLabels title={previewTitle} permission={camera.permission} />
            </View>
            {isCapturing || isPaused ? (
              <>
                <CaptureFeedbackCard
                  session={flow.session}
                  camera={flow.camera}
                  isPreviewActive={flow.isPreviewActive}
                />
                <CaptureGuidanceCard
                  session={flow.session}
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
              ? '本次会录制无声原始视频，结束确认后随观察记录保存到本机，可在记录中回放。'
              : '此安装包尚未包含相机模块，请更新安装包后使用。'}
          </AppText>
        </>
      )}
      {!poseGateway.canRecord || !poseGateway.canRecordVideo ? (
        <AppNotice status="warning">请重新构建安装包，加载竖向视频与关键点记录能力。</AppNotice>
      ) : null}
      {!canSaveObservation ? (
        <AppNotice status="warning">请重新构建安装包，加载此任务的报告存储能力。</AppNotice>
      ) : null}
      {!isModelSupported ? (
        <AppNotice status="warning">请更新安装包以使用所选模型，或在设置中改用 Lite。</AppNotice>
      ) : null}
      {flow.recordingError ? <AppNotice>{flow.recordingError}</AppNotice> : null}
      {isReading ? <AppLoading>正在读取采集数据…</AppLoading> : null}
      {isDiscarding ? <AppLoading>正在退出观察…</AppLoading> : null}
      {readError ? <AppNotice>{readError}</AppNotice> : null}
      {flow.session.phase === 'preparing' ? (
        <AppCardStack>
          <TaskProtocolCard protocol={flow.session.taskProtocol} />
          <CaptureStartCard
            task={task}
            patient={patient}
            isConfirmed={hasSafetyConfirmation}
            isStarting={flow.isStarting}
            onConfirm={setHasSafetyConfirmation}
            onBegin={() => void flow.begin()}
          />
        </AppCardStack>
      ) : null}
    </ScreenLayout>
  );
}
