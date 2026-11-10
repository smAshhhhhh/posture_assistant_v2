import type { AffectedSide } from '../patients/types';

import { analyzeJoint } from './angleAnalysis';
import type { AngleAnalysis } from './angleAnalysis';
import { angleAnalysisSettings, getAngleObservationProtocol } from './angleProtocols';
import { getAnalysisFrames, isSameCaptureSegment } from './analysisRecording';
import type { AnalysisFrame, AnalyzableRecording } from './analysisRecording';
import { sitToStandSettings, summarizeSitToStand } from './sitToStandProtocol';
import type { SitToStandCycle } from './sitToStandProtocol';

interface BodyPosition {
  readonly hipHeight: number;
  readonly legLength: number;
  readonly ankleX: number;
  readonly ankleY: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
}

type Movement =
  | { readonly phase: 'unknown' }
  | { readonly phase: 'seated'; readonly anchor: BodyPosition }
  | { readonly phase: 'rising'; readonly anchor: BodyPosition; readonly startedAtMs: number }
  | {
      readonly phase: 'standing';
      readonly anchor: BodyPosition;
      readonly startedAtMs: number;
      readonly standingAtMs: number;
      readonly standingHeight: number;
    }
  | {
      readonly phase: 'sitting';
      readonly anchor: BodyPosition;
      readonly startedAtMs: number;
      readonly standingAtMs: number;
      readonly descentStartedAtMs: number;
    };

function bodyPosition(frame: AnalysisFrame, side: AffectedSide): BodyPosition | null {
  const offset = side === 'left' ? 0 : 1;
  const hip = frame.landmarks[23 + offset];
  const knee = frame.landmarks[25 + offset];
  const ankle = frame.landmarks[27 + offset];
  if (!hip || !knee || !ankle) return null;
  const legLength =
    Math.hypot((hip.x - knee.x) * frame.imageWidth, (hip.y - knee.y) * frame.imageHeight) +
    Math.hypot((knee.x - ankle.x) * frame.imageWidth, (knee.y - ankle.y) * frame.imageHeight);
  if (legLength < 2) return null;
  return {
    hipHeight: (ankle.y - hip.y) * frame.imageHeight,
    legLength,
    ankleX: ankle.x * frame.imageWidth,
    ankleY: ankle.y * frame.imageHeight,
    imageWidth: frame.imageWidth,
    imageHeight: frame.imageHeight,
  };
}

function isSameView(position: BodyPosition, anchor: BodyPosition): boolean {
  return (
    position.imageWidth === anchor.imageWidth &&
    position.imageHeight === anchor.imageHeight &&
    Math.abs(position.legLength / anchor.legLength - 1) <= sitToStandSettings.legLengthTolerance &&
    Math.hypot(position.ankleX - anchor.ankleX, position.ankleY - anchor.ankleY) /
      anchor.legLength <=
      sitToStandSettings.footPositionTolerance
  );
}

export function analyzeSitToStand(
  recording: AnalyzableRecording,
  side: AffectedSide,
): AngleAnalysis {
  const frames = getAnalysisFrames(recording);
  const base = analyzeJoint(recording, side, 'sit_to_stand');
  const protocol = getAngleObservationProtocol('sit_to_stand');
  const cycles: SitToStandCycle[] = [];
  let movement: Movement = { phase: 'unknown' };
  let candidate: { readonly atMs: number; readonly position: BodyPosition } | null = null;
  let previousMs = -Infinity;
  const series = base.series.map((sample, index) => {
    const frame = frames[index];
    const position = frame && sample.angle !== null ? bodyPosition(frame, side) : null;
    if (
      !isSameCaptureSegment(frames[index - 1], frame) ||
      sample.timestampMs - previousMs > angleAnalysisSettings.maxGapMs
    ) {
      movement = { phase: 'unknown' };
      candidate = null;
    }
    previousMs = sample.timestampMs;
    if (
      !position ||
      sample.angle === null ||
      (movement.phase !== 'unknown' && !isSameView(position, movement.anchor))
    ) {
      movement = { phase: 'unknown' };
      candidate = null;
      return { ...sample, angle: null };
    }
    const atMs = sample.timestampMs;
    const angle = sample.angle;
    const isSeated = angle <= protocol.startAngle;
    const relativeHeight =
      movement.phase === 'unknown'
        ? 0
        : (position.hipHeight - movement.anchor.hipHeight) / movement.anchor.legLength;
    const isStanding =
      angle >= protocol.targetAngle && relativeHeight >= sitToStandSettings.standingHeight;
    const isBackAtSeat =
      isSeated && Math.abs(relativeHeight) <= sitToStandSettings.seatedHeightTolerance;
    const needsStability =
      (movement.phase === 'unknown' && isSeated) ||
      (movement.phase === 'rising' && isStanding) ||
      (movement.phase === 'sitting' && isBackAtSeat);
    candidate = needsStability
      ? candidate && isSameView(position, candidate.position)
        ? candidate
        : { atMs, position }
      : null;
    const stable = candidate && atMs - candidate.atMs >= sitToStandSettings.stableDurationMs;
    switch (movement.phase) {
      case 'unknown':
        if (stable && candidate) movement = { phase: 'seated', anchor: candidate.position };
        break;
      case 'seated':
        if (
          angle > sitToStandSettings.movementAngle &&
          relativeHeight > sitToStandSettings.movementHeight
        ) {
          movement = { phase: 'rising', anchor: movement.anchor, startedAtMs: atMs };
        }
        break;
      case 'rising':
        if (isBackAtSeat) {
          movement = { phase: 'seated', anchor: position };
        } else if (stable && candidate) {
          movement = {
            ...movement,
            phase: 'standing',
            standingAtMs: candidate.atMs,
            standingHeight: position.hipHeight,
          };
        }
        break;
      case 'standing':
        if (
          angle < sitToStandSettings.descentAngle &&
          (movement.standingHeight - position.hipHeight) / movement.anchor.legLength >
            sitToStandSettings.movementHeight
        ) {
          movement = { ...movement, phase: 'sitting', descentStartedAtMs: atMs };
        }
        break;
      case 'sitting':
        if (isStanding) {
          movement = { ...movement, phase: 'standing', standingHeight: position.hipHeight };
        } else if (stable && candidate) {
          cycles.push({
            startedAtMs: movement.startedAtMs,
            standingAtMs: movement.standingAtMs,
            descentStartedAtMs: movement.descentStartedAtMs,
            endedAtMs: candidate.atMs,
          });
          movement = { phase: 'seated', anchor: position };
        }
        break;
    }
    // 稳定窗口不能沿用到下一个阶段。
    if (stable) candidate = null;
    return sample;
  });
  // 机位或腿部几何异常也计入缺失，质量与计数使用同一条可用时间轴。
  let coveredMs = 0;
  let gapStartMs = 0;
  let longestGapMs = 0;
  let validSampleCount = 0;
  for (let index = 0; index < series.length; index++) {
    const sample = series[index];
    if (!sample || sample.angle === null) continue;
    const previous = series[index - 1];
    const gapMs = previous ? sample.timestampMs - previous.timestampMs : Infinity;
    if (
      previous?.angle !== null &&
      previous?.segmentIndex === sample.segmentIndex &&
      gapMs <= angleAnalysisSettings.maxGapMs
    )
      coveredMs += gapMs;
    else longestGapMs = Math.max(longestGapMs, sample.timestampMs - gapStartMs);
    gapStartMs = sample.timestampMs;
    ++validSampleCount;
  }
  longestGapMs = Math.max(longestGapMs, recording.durationMs - gapStartMs);
  const coverage = recording.durationMs > 0 ? coveredMs / recording.durationMs : 0;
  const invalid =
    base.captureQuality === 'invalid_capture' ||
    validSampleCount < angleAnalysisSettings.minimumSamples ||
    coverage < 0.5;
  const angles = series.flatMap((sample) => (sample.angle === null ? [] : [sample.angle]));
  return {
    ...base,
    captureQuality: invalid
      ? 'invalid_capture'
      : coverage >= 0.85 && longestGapMs <= 500
        ? 'valid'
        : 'degraded',
    coverage,
    longestGapMs,
    validSampleCount,
    minAngle: invalid ? null : Math.min(...angles),
    maxAngle: invalid ? null : Math.max(...angles),
    rangeOfMotion: invalid ? null : Math.max(...angles) - Math.min(...angles),
    repetitions: invalid ? null : cycles.length,
    series: invalid ? series.map((sample) => ({ ...sample, angle: null })) : series,
    sitToStand: summarizeSitToStand(invalid ? [] : cycles),
  };
}
