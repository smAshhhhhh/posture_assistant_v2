import { getTaskInstructions } from '../tasks/taskInstructions';

import type { CaptureContext, CapturePauseReason, CaptureSession } from './captureSession';
import type { PoseCameraState } from './poseCamera';

interface CaptureFeedback {
  readonly code: string;
  readonly title: string;
  readonly message: string;
}

const cameraErrors: Record<string, string> = {
  model_unavailable: '离线姿态模型加载失败，请检查模型文件后重试。',
  native_library_unavailable: '此设备暂时无法运行姿态识别。',
  permission_missing: '相机权限不可用，请重新检查授权。',
  camera_unavailable: '无法打开后置相机，请关闭其他使用相机的应用后重试。',
  inference_failed: '姿态识别中断，请重试采集。',
  coordinate_transform_failed: '骨架与画面无法对齐，请重试采集。',
  activity_unavailable: '请返回应用前台后重试。',
  video_recording_failed: '录像中断，请检查设备存储空间后重试采集。',
};

const pauseMessages: Record<CapturePauseReason, string> = {
  manual: '本次采集已手动暂停，暂停时间不计入采集时长。',
  background: '应用离开前台或相机被中断，采集已暂停。',
  permission_lost: '相机授权发生变化，采集已暂停。请先重新授权。',
  device_error: '相机、识别或录像发生中断，采集已暂停。',
};

export function getCaptureFeedback(
  session: CaptureSession,
  camera: PoseCameraState,
  isPreviewActive: boolean,
): CaptureFeedback {
  if (session.phase === 'finished' || session.phase === 'discarded') {
    return {
      code: session.phase,
      title: session.phase === 'finished' ? '本次观察已结束' : '本次观察已放弃',
      message: '本次采集已经停止。',
    };
  }
  const error = cameraErrors[camera.code] ?? '相机不可用，请重试采集。';
  if (session.phase === 'paused') {
    const reason = pauseMessages[session.pauseReason ?? 'manual'];
    const recovery = isPreviewActive
      ? '正在恢复相机，恢复后将自动继续记录。'
      : '点击“继续采集”即可恢复记录。';
    return {
      code: 'paused',
      title: '采集已暂停',
      message: `${reason}${camera.status === 'error' ? error : ''}${recovery}`,
    };
  }
  return getCameraFeedback(session.context, camera, isPreviewActive);
}

function getCameraFeedback(
  context: CaptureContext,
  camera: PoseCameraState,
  isPreviewActive: boolean,
): CaptureFeedback {
  if (camera.status === 'error') {
    return {
      code: 'device_error',
      title: '相机或识别不可用',
      message: cameraErrors[camera.code] ?? '相机不可用，请重试采集。',
    };
  }
  if (!isPreviewActive) {
    return {
      code: 'preview_off',
      title: '相机预览未开启',
      message: '请确认相机授权后点击“开始采集”。',
    };
  }
  if (camera.status !== 'ready') {
    return {
      code: 'waiting',
      title: '等待相机与姿态识别就绪',
      message:
        camera.status === 'starting'
          ? '正在准备相机与离线模型…'
          : '若长时间没有预览，请确认相机权限后重试采集。',
    };
  }
  if (camera.code === 'summary_stale') {
    return {
      code: 'summary_stale',
      title: '识别摘要暂未更新',
      message: '当前无法确认关节是否可用。若持续无更新，可暂停后点击“继续采集”重试。',
    };
  }
  if (camera.frameTimestampMs === null || camera.landmarkCount === null || camera.code !== 'none') {
    return {
      code: 'summary_unavailable',
      title: '暂无可用识别摘要',
      message: '当前无法确认关节是否可用，请检查相机画面后重试。',
    };
  }
  const { framing } = getTaskInstructions(context.taskId, context.affectedSide);
  if (camera.landmarkCount === 0) {
    return {
      code: 'body_missing',
      title: '暂未检测到人体',
      message: `${framing}请检查拍摄距离与光线。`,
    };
  }
  if (!camera.hasRequiredLandmarks) {
    return {
      code: 'landmarks_unclear',
      title: '关键关节暂不清晰',
      message: `${framing}请检查遮挡与光线。`,
    };
  }
  return {
    code: 'ready',
    title: '关键关节当前可用',
    message: '此提示仅说明当前识别情况，动作与完成情况由现场确认。',
  };
}
