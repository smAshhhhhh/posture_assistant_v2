import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { CameraPermission } from '@/domain/capture/cameraPermission';
import { getCaptureBlockers } from '@/domain/capture/captureReadiness';
import type { CaptureReadiness } from '@/domain/capture/captureReadiness';
import {
  createCaptureSession,
  getCaptureDurationMs,
  transitionCaptureSession,
} from '@/domain/capture/captureSession';
import type { CaptureContext, CaptureEvent } from '@/domain/capture/captureSession';
import type { PoseCameraGateway, PoseCameraState } from '@/domain/capture/poseCamera';
import {
  expirePoseCameraStream,
  initialPoseCameraStream,
  receivePoseCameraState,
} from '@/domain/capture/poseCameraStream';
import type { PoseCameraStream } from '@/domain/capture/poseCameraStream';

import { createCameraStartup } from '../model/cameraStartup';

interface CaptureFlowOptions {
  readonly context: CaptureContext;
  readonly permission: CameraPermission;
  readonly isFocused: boolean;
  readonly hasSafetyConfirmation: boolean;
  readonly gateway: PoseCameraGateway;
  readonly shouldRecord: boolean;
  readonly canSaveObservation: boolean;
}

export function useCaptureFlow({
  context,
  permission,
  isFocused,
  hasSafetyConfirmation,
  gateway,
  shouldRecord,
  canSaveObservation,
}: CaptureFlowOptions) {
  const [session, setSession] = useState(() => createCaptureSession(context));
  const sessionRef = useRef(session);
  const [camera, setCamera] = useState(initialPoseCameraStream.camera);
  const cameraStream = useRef(initialPoseCameraStream);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  const [isPreviewEnabled, setIsPreviewEnabled] = useState(true);
  const isPreviewEnabledRef = useRef(true);
  const [isReleasing, setIsReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const isMounted = useRef(true);
  const releasePromise = useRef<Promise<boolean> | null>(null);
  const releaseFailed = useRef(false);
  const [cameraStartup] = useState(createCameraStartup);
  const previousPermission = useRef(permission);
  const starting = useRef(false);
  const startGeneration = useRef(0);
  const [isStarting, setIsStarting] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const invalidateStart = useCallback(() => {
    ++startGeneration.current;
    cameraStartup.cancel();
  }, [cameraStartup]);

  const updateCamera = useCallback((stream: PoseCameraStream) => {
    cameraStream.current = stream;
    setCamera(stream.camera);
  }, []);

  const applyEvent = useCallback((event: CaptureEvent) => {
    const next = transitionCaptureSession(sessionRef.current, event);
    sessionRef.current = next;
    setSession(next);
  }, []);

  const release = useCallback((): Promise<boolean> => {
    if (releasePromise.current) return releasePromise.current;
    releaseFailed.current = false;
    setIsReleasing(true);
    setReleaseError(null);
    const operation = Promise.resolve()
      .then(() => gateway.stop())
      .then(() => true)
      .catch(() => {
        releaseFailed.current = true;
        if (isMounted.current) setReleaseError('无法确认相机已释放，请重试释放。');
        return false;
      })
      .finally(() => {
        releasePromise.current = null;
        if (isMounted.current) setIsReleasing(false);
      });
    releasePromise.current = operation;
    return operation;
  }, [gateway]);

  const interrupt = useCallback(
    (reason: 'background' | 'permission_lost' | 'device_error') => {
      if (!isMounted.current) return;
      invalidateStart();
      applyEvent({ type: 'pause', atMs: performance.now(), reason });
      isPreviewEnabledRef.current = false;
      setIsPreviewEnabled(false);
      updateCamera(initialPoseCameraStream);
      void release();
    },
    [applyEvent, invalidateStart, release, updateCamera],
  );

  useEffect(() => {
    isMounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      setIsAppActive(state === 'active');
      if (state !== 'active') interrupt('background');
    });
    return () => {
      isMounted.current = false;
      invalidateStart();
      subscription.remove();
      void gateway.stop().catch(() => undefined);
    };
  }, [gateway, interrupt, invalidateStart]);

  useEffect(() => {
    const hasLostPermission = previousPermission.current === 'granted' && permission !== 'granted';
    previousPermission.current = permission;
    if (!isFocused || hasLostPermission) {
      interrupt(!isFocused ? 'background' : 'permission_lost');
    }
  }, [interrupt, isFocused, permission]);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentMs = performance.now();
      setNowMs(currentMs);
      const next = expirePoseCameraStream(cameraStream.current, currentMs);
      if (next !== cameraStream.current) updateCamera(next);
    }, 250);
    return () => clearInterval(timer);
  }, [updateCamera]);

  const onCameraStatus = useCallback(
    (state: PoseCameraState) => {
      if (!isMounted.current || !isPreviewEnabledRef.current || releasePromise.current) return;
      updateCamera(receivePoseCameraState(cameraStream.current, state, performance.now()));
      cameraStartup.update(state);
      if (
        state.status === 'error' ||
        state.status === 'background' ||
        state.status === 'interrupted'
      ) {
        const reason = state.code === 'permission_missing' ? 'permission_lost' : 'device_error';
        interrupt(state.status === 'error' ? reason : 'background');
        updateCamera(receivePoseCameraState(initialPoseCameraStream, state, performance.now()));
      }
    },
    [cameraStartup, interrupt, updateCamera],
  );

  const readiness: CaptureReadiness = useMemo(
    () => ({
      hasPatient: context.patientId.length > 0,
      hasSafetyConfirmation,
      isAppActive: isAppActive && isFocused,
    }),
    [context, hasSafetyConfirmation, isAppActive, isFocused],
  );

  const begin = useCallback(async () => {
    if (starting.current || !['preparing', 'paused'].includes(sessionRef.current.phase)) return;
    if (getCaptureBlockers(readiness).length > 0) return;
    // 按钮只依赖人工确认，设备问题在实际启动时明确反馈。
    if (AppState.currentState !== 'active') return;
    if (!gateway.isAvailable) {
      setRecordingError('此安装包尚未包含相机模块，请更新安装包后使用。');
      return;
    }
    if (permission !== 'granted') {
      setRecordingError('请允许使用相机后，再开始采集。');
      return;
    }
    if (
      shouldRecord &&
      (!gateway.canRecord || !gateway.canRecordVideo || !gateway.beginRecording)
    ) {
      setRecordingError('请重新构建安装包，加载 4:3 视频与关键点记录能力。');
      return;
    }
    if (shouldRecord && !canSaveObservation) {
      setRecordingError('请重新构建安装包，加载此任务的报告存储能力。');
      return;
    }
    starting.current = true;
    setIsStarting(true);
    setRecordingError(null);
    const token = ++startGeneration.current;
    const phase = sessionRef.current.phase;
    const isCurrent = () =>
      isMounted.current &&
      token === startGeneration.current &&
      AppState.currentState === 'active' &&
      sessionRef.current.phase === phase;
    try {
      if (releasePromise.current) await releasePromise.current;
      if (!isCurrent()) return;
      if (releaseFailed.current) {
        setRecordingError('相机尚未成功释放，请先重试释放后再继续。');
        return;
      }
      if (!isPreviewEnabledRef.current || cameraStream.current.camera.status !== 'ready') {
        // 继续按钮自动恢复预览；设备就绪后接续录像，无需人工检查。
        const ready = cameraStartup.wait();
        if (!isPreviewEnabledRef.current) {
          updateCamera(initialPoseCameraStream);
          isPreviewEnabledRef.current = true;
          setIsPreviewEnabled(true);
        }
        const isReady = await ready;
        if (!isCurrent()) return;
        if (!isReady) throw new Error('相机未能就绪');
      }
      if (!isCurrent()) return;
      if (shouldRecord) await gateway.beginRecording?.(phase === 'paused');
      if (!isCurrent()) {
        if (isMounted.current && token === startGeneration.current) interrupt('device_error');
        return;
      }
      applyEvent({
        type: sessionRef.current.phase === 'paused' ? 'resume' : 'start',
        atMs: performance.now(),
        readiness,
      });
    } catch {
      if (isMounted.current && token === startGeneration.current) {
        setRecordingError('相机或录像未能开始，请检查相机权限和存储空间后重试。');
        interrupt('device_error');
      }
    } finally {
      starting.current = false;
      if (isMounted.current) setIsStarting(false);
    }
  }, [
    applyEvent,
    canSaveObservation,
    cameraStartup,
    gateway,
    interrupt,
    permission,
    readiness,
    shouldRecord,
    updateCamera,
  ]);

  const stop = useCallback(
    (type: 'pause' | 'finish') => {
      invalidateStart();
      const atMs = performance.now();
      applyEvent(type === 'pause' ? { type, atMs, reason: 'manual' } : { type, atMs });
      isPreviewEnabledRef.current = false;
      setIsPreviewEnabled(false);
      updateCamera(initialPoseCameraStream);
      void release();
    },
    [applyEvent, invalidateStart, release, updateCamera],
  );

  return {
    session,
    camera,
    isReleasing,
    releaseError,
    recordingError,
    isStarting,
    durationMs: getCaptureDurationMs(session, nowMs),
    canBegin: !isStarting && hasSafetyConfirmation,
    isPreviewActive:
      isPreviewEnabled &&
      permission === 'granted' &&
      isAppActive &&
      isFocused &&
      (session.phase === 'preparing' ||
        session.phase === 'capturing' ||
        session.phase === 'paused'),
    begin,
    stop,
    onCameraStatus,
    retryRelease: release,
  };
}
