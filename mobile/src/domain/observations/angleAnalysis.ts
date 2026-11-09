import { getRequiredLandmarks } from '../capture/requiredLandmarks';
import type { AffectedSide } from '../patients/types';

import { angleAnalysisSettings, getAngleObservationProtocol } from './angleProtocols';
import type { AngleObservationTaskId } from './angleProtocols';
import type { PoseFrame, PoseLandmark, PoseRecording } from './poseRecording';
import type { CaptureQuality } from './types';
import type { SitToStandMetrics } from './sitToStandProtocol';
import type { MarchInPlaceMetrics } from './marchInPlaceProtocol';
import type { ShortWalkMetrics } from './shortWalkProtocol';

export interface AngleSample {
  readonly timestampMs: number;
  readonly angle: number | null;
}

export interface AngleAnalysis {
  readonly captureQuality: CaptureQuality;
  readonly coverage: number;
  readonly validSampleCount: number;
  readonly longestGapMs: number;
  readonly minAngle: number | null;
  readonly maxAngle: number | null;
  readonly rangeOfMotion: number | null;
  readonly repetitions: number | null;
  readonly series: readonly AngleSample[];
  readonly sitToStand?: SitToStandMetrics;
  readonly marchInPlace?: MarchInPlaceMetrics;
  readonly shortWalk?: ShortWalkMetrics;
}

function isUsable(point: PoseLandmark | undefined): point is PoseLandmark {
  return (
    point !== undefined &&
    point.visibility >= angleAnalysisSettings.confidence &&
    point.presence >= angleAnalysisSettings.confidence &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function getJointAngle(
  frame: PoseFrame,
  side: AffectedSide,
  taskId: AngleObservationTaskId,
): number | null {
  const protocol = getAngleObservationProtocol(taskId);
  if (
    !frame.isInPreview ||
    !getRequiredLandmarks(taskId, side).every((index) => isUsable(frame.landmarks[index]))
  ) {
    return null;
  }
  const offset = side === 'left' ? 0 : 1;
  const [first, center, last] = protocol.leftIndices.map(
    (index) => frame.landmarks[index + offset],
  );
  if (!first || !center || !last) return null;
  // 还原图像宽高比，避免非方形画面的夹角失真。
  const ax = (first.x - center.x) * frame.imageWidth;
  const ay = (first.y - center.y) * frame.imageHeight;
  const bx = (last.x - center.x) * frame.imageWidth;
  const by = (last.y - center.y) * frame.imageHeight;
  const lengthA = Math.hypot(ax, ay);
  const lengthB = Math.hypot(bx, by);
  if (protocol.measurement === 'image_vertical') {
    if (lengthA < 1) return null;
    // 使用画面竖直方向，不把膝的位置或镜头倾斜当作躯干运动校正。
    const cosine = -ay / lengthA;
    return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
  }
  if (lengthA < 1 || lengthB < 1) return null;
  const cosine = (ax * bx + ay * by) / (lengthA * lengthB);
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

export function analyzeJoint(
  recording: PoseRecording,
  side: AffectedSide,
  taskId: AngleObservationTaskId,
): AngleAnalysis {
  const protocol = getAngleObservationProtocol(taskId);
  let filtered: number | null = null;
  let previous: AngleSample | null = null;
  let coveredMs = 0;
  let gapStartMs = 0;
  let longestGapMs = 0;
  let validSampleCount = 0;
  let repetitions = 0;
  let phase: 'unknown' | 'start' | 'target' = 'unknown';
  const angles: number[] = [];
  const series = recording.frames.map((frame): AngleSample => {
    const raw = getJointAngle(frame, side, taskId);
    const gapMs = previous ? frame.timestampMs - previous.timestampMs : Infinity;
    const isContinuous = previous?.angle !== null && gapMs <= angleAnalysisSettings.maxGapMs;
    if (raw === null) {
      filtered = null;
      phase = 'unknown';
    } else {
      if (previous && isContinuous) {
        coveredMs += gapMs;
      } else {
        longestGapMs = Math.max(longestGapMs, frame.timestampMs - gapStartMs);
        phase = 'unknown';
      }
      const alpha = 1 - Math.exp(-gapMs / angleAnalysisSettings.smoothingTimeMs);
      filtered = filtered !== null && isContinuous ? filtered + alpha * (raw - filtered) : raw;
      gapStartMs = frame.timestampMs;
      angles.push(filtered);
      ++validSampleCount;
      const isAtStart =
        protocol.cycleStart === 'low'
          ? filtered <= protocol.startAngle
          : filtered >= protocol.startAngle;
      const isAtTarget =
        protocol.cycleStart === 'low'
          ? filtered >= protocol.targetAngle
          : filtered <= protocol.targetAngle;
      if (isAtStart) {
        if (phase === 'target') ++repetitions;
        phase = 'start';
      } else if (isAtTarget && phase === 'start') {
        phase = 'target';
      }
    }
    previous = { timestampMs: frame.timestampMs, angle: filtered };
    return previous;
  });
  longestGapMs = Math.max(longestGapMs, recording.durationMs - gapStartMs);
  const coverage = recording.durationMs > 0 ? Math.min(1, coveredMs / recording.durationMs) : 0;
  const isInvalid =
    recording.isTruncated ||
    recording.durationMs < angleAnalysisSettings.minimumDurationMs ||
    validSampleCount < angleAnalysisSettings.minimumSamples ||
    coverage < 0.5;
  const captureQuality = isInvalid
    ? 'invalid_capture'
    : coverage >= 0.85 && longestGapMs <= 500
      ? 'valid'
      : 'degraded';
  return {
    captureQuality,
    coverage,
    validSampleCount,
    longestGapMs,
    minAngle: isInvalid ? null : Math.min(...angles),
    maxAngle: isInvalid ? null : Math.max(...angles),
    rangeOfMotion: isInvalid ? null : Math.max(...angles) - Math.min(...angles),
    repetitions: isInvalid ? null : repetitions,
    // 无效采集保留时间轴，受影响指标保持缺失。
    series: isInvalid ? series.map((sample) => ({ ...sample, angle: null })) : series,
  };
}
