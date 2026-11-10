import type { AffectedSide } from '../patients/types';

import { analyzeJoint } from './angleAnalysis';
import type { AngleAnalysis } from './angleAnalysis';
import { angleAnalysisSettings } from './angleProtocols';
import {
  isSameMarchView,
  isStableMarchPosition,
  marchLiftRatio,
  marchPosition,
} from './marchInPlaceGeometry';
import type { MarchPosition } from './marchInPlaceGeometry';
import { marchInPlaceSettings as settings, summarizeMarchInPlace } from './marchInPlaceProtocol';
import type { MarchSide, MarchStep } from './marchInPlaceProtocol';
import { getAnalysisFrames, isSameCaptureSegment } from './analysisRecording';
import type { AnalyzableRecording } from './analysisRecording';

interface ActiveStep {
  readonly side: MarchSide;
  readonly startedAtMs: number;
  readonly peakAtMs: number;
  readonly liftRatio: number;
}

export function analyzeMarchInPlace(
  recording: AnalyzableRecording,
  side: AffectedSide,
): AngleAnalysis {
  const frames = getAnalysisFrames(recording);
  const base = analyzeJoint(recording, side, 'march_in_place');
  const steps: MarchStep[] = [];
  let baseline: MarchPosition | null = null;
  let candidate: MarchPosition | null = null;
  let active: ActiveStep | null = null;
  let segmentIndex = 0;
  let hasBaseline = false;
  let previousMs = -Infinity;
  function reset() {
    if (baseline || candidate || active) segmentIndex += 1;
    baseline = null;
    candidate = null;
    active = null;
  }
  const series = base.series.map((sample, index) => {
    const frame = frames[index];
    const position = frame && sample.angle !== null ? marchPosition(frame) : null;
    if (
      !isSameCaptureSegment(frames[index - 1], frame) ||
      sample.timestampMs - previousMs > angleAnalysisSettings.maxGapMs
    )
      reset();
    previousMs = sample.timestampMs;
    if (!position || (baseline && !isSameMarchView(position, baseline))) {
      reset();
      return { ...sample, angle: null };
    }
    if (!baseline) {
      if (!isStableMarchPosition(position, position)) {
        candidate = null;
      } else {
        if (!candidate || !isStableMarchPosition(position, candidate)) candidate = position;
        if (position.timestampMs - candidate.timestampMs >= settings.baselineDurationMs) {
          baseline = candidate;
          candidate = null;
          hasBaseline = true;
        }
      }
      return sample;
    }
    const left = marchLiftRatio(position, baseline, 'left');
    const right = marchLiftRatio(position, baseline, 'right');
    const ratios = { left, right };
    const atMs = position.timestampMs;
    // 支撑脚也明显离开基线时不把双脚跳或机位漂移当成两步。
    if (
      (left > settings.returnRatio && right > settings.returnRatio) ||
      left < -settings.returnRatio ||
      right < -settings.returnRatio ||
      left > 1 ||
      right > 1 ||
      (active && atMs - active.startedAtMs > settings.maximumStepDurationMs)
    ) {
      reset();
      return { ...sample, angle: null };
    }
    if (active) {
      const ratio = ratios[active.side];
      if (ratio > active.liftRatio) active = { ...active, peakAtMs: atMs, liftRatio: ratio };
      if (ratio <= settings.returnRatio) {
        if (atMs - active.startedAtMs >= settings.minimumStepDurationMs) {
          steps.push({ ...active, segmentIndex, endedAtMs: atMs });
        }
        active = null;
      }
    } else {
      const liftedSide =
        left >= settings.liftRatio ? 'left' : right >= settings.liftRatio ? 'right' : null;
      if (liftedSide) {
        active = {
          side: liftedSide,
          startedAtMs: atMs,
          peakAtMs: atMs,
          liftRatio: ratios[liftedSide],
        };
      }
    }
    return sample;
  });
  // 计数、质量及报告均使用经过双腿与机位校验的时间轴。
  let coveredMs = 0;
  let gapStartMs = 0;
  let longestGapMs = 0;
  let validSampleCount = 0;
  for (let index = 0; index < series.length; index += 1) {
    const sample = series[index];
    if (!sample || sample.angle === null) continue;
    const previous = series[index - 1];
    const gapMs = previous ? sample.timestampMs - previous.timestampMs : Infinity;
    if (
      previous &&
      previous.angle !== null &&
      previous.segmentIndex === sample.segmentIndex &&
      gapMs <= angleAnalysisSettings.maxGapMs
    ) {
      coveredMs += gapMs;
    } else {
      longestGapMs = Math.max(longestGapMs, sample.timestampMs - gapStartMs);
    }
    gapStartMs = sample.timestampMs;
    validSampleCount += 1;
  }
  longestGapMs = Math.max(longestGapMs, recording.durationMs - gapStartMs);
  const coverage = recording.durationMs > 0 ? coveredMs / recording.durationMs : 0;
  const invalid =
    base.captureQuality === 'invalid_capture' ||
    !hasBaseline ||
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
    repetitions: invalid ? null : steps.length,
    series: invalid ? series.map((sample) => ({ ...sample, angle: null })) : series,
    marchInPlace: summarizeMarchInPlace(steps, recording.durationMs, invalid),
  };
}
