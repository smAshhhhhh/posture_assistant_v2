import type { AffectedSide } from '../patients/types';

import { getJointAngle } from './angleAnalysis';
import type { AngleAnalysis } from './angleAnalysis';
import { angleAnalysisSettings } from './angleProtocols';
import { detectShortWalkCycles } from './shortWalkCycles';
import {
  shortWalkAngle,
  shortWalkSettings as settings,
  summarizeShortWalk,
} from './shortWalkProtocol';
import type { ShortWalkSample } from './shortWalkProtocol';
import type { PoseFrame, PoseRecording } from './poseRecording';

interface WalkPosition {
  readonly timestampMs: number;
  readonly width: number;
  readonly height: number;
  readonly hipX: number;
  readonly hipY: number;
  readonly leftLength: number;
  readonly rightLength: number;
  readonly leftAngle: number;
  readonly rightAngle: number;
}

function walkPosition(frame: PoseFrame): WalkPosition | null {
  const leftAngle = getJointAngle(frame, 'left', 'short_walk');
  const rightAngle = getJointAngle(frame, 'right', 'short_walk');
  const leftHip = frame.landmarks[23];
  const rightHip = frame.landmarks[24];
  if (leftAngle === null || rightAngle === null || !leftHip || !rightHip) return null;
  const { imageWidth: width, imageHeight: height } = frame;
  const lengths = [0, 1].map((offset) => {
    const hip = frame.landmarks[23 + offset];
    const knee = frame.landmarks[25 + offset];
    const ankle = frame.landmarks[27 + offset];
    if (!hip || !knee || !ankle) return 0;
    return (
      Math.hypot((hip.x - knee.x) * width, (hip.y - knee.y) * height) +
      Math.hypot((knee.x - ankle.x) * width, (knee.y - ankle.y) * height)
    );
  });
  const [leftLength, rightLength] = lengths;
  if (
    !leftLength ||
    !rightLength ||
    Math.min(leftLength, rightLength) < settings.minimumLegLengthPx
  )
    return null;
  return {
    timestampMs: frame.timestampMs,
    width,
    height,
    hipX: ((leftHip.x + rightHip.x) * width) / 2,
    hipY: ((leftHip.y + rightHip.y) * height) / 2,
    leftLength,
    rightLength,
    leftAngle,
    rightAngle,
  };
}

function sameWalkView(position: WalkPosition, anchor: WalkPosition, previous: WalkPosition) {
  const length = (anchor.leftLength + anchor.rightLength) / 2;
  const elapsed = position.timestampMs - previous.timestampMs;
  return (
    position.width === anchor.width &&
    position.height === anchor.height &&
    Math.abs(position.leftLength / anchor.leftLength - 1) <= settings.maximumScaleChange &&
    Math.abs(position.rightLength / anchor.rightLength - 1) <= settings.maximumScaleChange &&
    Math.abs(position.hipY - anchor.hipY) / length <= settings.maximumHipHeightChange &&
    Math.abs(position.hipX - previous.hipX) / length <=
      (settings.maximumHipSpeedRatio * elapsed) / 1_000
  );
}

export function analyzeShortWalk(recording: PoseRecording, side: AffectedSide): AngleAnalysis {
  let anchor: WalkPosition | null = null;
  let previous: WalkPosition | null = null;
  let segmentIndex = 0;
  let leftFiltered: number | null = null;
  let rightFiltered: number | null = null;
  const samples = recording.frames.map((frame): ShortWalkSample => {
    const position = walkPosition(frame);
    const gap = previous ? frame.timestampMs - previous.timestampMs : Infinity;
    const badView = position && anchor && previous && !sameWalkView(position, anchor, previous);
    if (!position || badView || gap > angleAnalysisSettings.maxGapMs) {
      if (anchor) segmentIndex += 1;
      anchor = null;
      previous = null;
      leftFiltered = null;
      rightFiltered = null;
    }
    if (!position || badView) {
      return {
        timestampMs: frame.timestampMs,
        segmentIndex,
        leftKneeAngle: null,
        rightKneeAngle: null,
        hipOffsetRatio: null,
      };
    }
    if (!anchor) anchor = position;
    const alpha = 1 - Math.exp(-gap / angleAnalysisSettings.smoothingTimeMs);
    leftFiltered =
      leftFiltered === null
        ? position.leftAngle
        : leftFiltered + alpha * (position.leftAngle - leftFiltered);
    rightFiltered =
      rightFiltered === null
        ? position.rightAngle
        : rightFiltered + alpha * (position.rightAngle - rightFiltered);
    previous = position;
    return {
      timestampMs: frame.timestampMs,
      segmentIndex,
      // 统一保存与重算精度，减少长报告中的冗余小数。
      leftKneeAngle: Number(leftFiltered.toFixed(4)),
      rightKneeAngle: Number(rightFiltered.toFixed(4)),
      hipOffsetRatio: Number(
        ((position.hipX - anchor.hipX) / ((anchor.leftLength + anchor.rightLength) / 2)).toFixed(6),
      ),
    };
  });
  let coveredMs = 0;
  let gapStartMs = 0;
  let longestGapMs = 0;
  let validSampleCount = 0;
  samples.forEach((sample, index) => {
    if (sample.leftKneeAngle === null) return;
    const before = samples[index - 1];
    const gap = before ? sample.timestampMs - before.timestampMs : Infinity;
    if (
      before &&
      before.leftKneeAngle !== null &&
      before.segmentIndex === sample.segmentIndex &&
      gap <= angleAnalysisSettings.maxGapMs
    )
      coveredMs += gap;
    else longestGapMs = Math.max(longestGapMs, sample.timestampMs - gapStartMs);
    gapStartMs = sample.timestampMs;
    validSampleCount += 1;
  });
  longestGapMs = Math.max(longestGapMs, recording.durationMs - gapStartMs);
  const coverage = recording.durationMs > 0 ? coveredMs / recording.durationMs : 0;
  const invalid =
    recording.isTruncated ||
    recording.durationMs < angleAnalysisSettings.minimumDurationMs ||
    validSampleCount < angleAnalysisSettings.minimumSamples ||
    coverage < 0.5;
  const cycles = invalid ? [] : detectShortWalkCycles(samples);
  const usable = samples.flatMap((sample) => {
    const angle = shortWalkAngle(sample, side);
    return angle === null ? [] : [angle];
  });
  const resultSamples = invalid
    ? samples.map((sample) => ({
        ...sample,
        leftKneeAngle: null,
        rightKneeAngle: null,
        hipOffsetRatio: null,
      }))
    : samples;
  const shortWalk = summarizeShortWalk(resultSamples, cycles, invalid);
  return {
    captureQuality: invalid
      ? 'invalid_capture'
      : coverage >= 0.85 && longestGapMs <= 500
        ? 'valid'
        : 'degraded',
    coverage,
    longestGapMs,
    validSampleCount,
    minAngle: invalid ? null : Math.min(...usable),
    maxAngle: invalid ? null : Math.max(...usable),
    rangeOfMotion: invalid ? null : Math.max(...usable) - Math.min(...usable),
    repetitions: side === 'left' ? shortWalk.leftCycles : shortWalk.rightCycles,
    series: resultSamples.map((sample) => ({
      timestampMs: sample.timestampMs,
      angle: shortWalkAngle(sample, side),
    })),
    shortWalk,
  };
}
