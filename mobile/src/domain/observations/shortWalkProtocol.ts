import type { AffectedSide } from '../patients/types';

export interface ShortWalkSample {
  readonly timestampMs: number;
  readonly segmentIndex: number;
  readonly leftKneeAngle: number | null;
  readonly rightKneeAngle: number | null;
  readonly hipOffsetRatio: number | null;
}

export interface ShortWalkCycle {
  readonly side: AffectedSide;
  readonly segmentIndex: number;
  readonly startedAtMs: number;
  readonly extensionAtMs: number;
  readonly endedAtMs: number;
  readonly confirmedAtMs: number;
  readonly travelRatio: number;
}

export interface ShortWalkMetrics {
  readonly samples: readonly ShortWalkSample[];
  readonly cycles: readonly ShortWalkCycle[];
  readonly leftCycles: number | null;
  readonly rightCycles: number | null;
  readonly meanLeftCycleDurationMs: number | null;
  readonly meanRightCycleDurationMs: number | null;
  readonly leftKneeRange: number | null;
  readonly rightKneeRange: number | null;
  readonly kneeRangeDifference: number | null;
  readonly cycleDurationDifferenceMs: number | null;
}

// 参数仅用于固定侧面机位的投影周期识别，未作临床标定。
export const shortWalkSettings = {
  extendedAngle: 155,
  flexedAngle: 135,
  minimumCycleDurationMs: 400,
  maximumCycleDurationMs: 6_000,
  minimumTravelRatio: 0.25,
  maximumBackwardRatio: 0.15,
  minimumLegLengthPx: 12,
  maximumScaleChange: 0.25,
  maximumHipHeightChange: 0.25,
  maximumHipSpeedRatio: 4,
} as const;

export function shortWalkAngle(sample: ShortWalkSample, side: AffectedSide) {
  return side === 'left' ? sample.leftKneeAngle : sample.rightKneeAngle;
}

export function summarizeShortWalk(
  samples: readonly ShortWalkSample[],
  cycles: readonly ShortWalkCycle[],
  invalid: boolean,
): ShortWalkMetrics {
  const left = cycles.filter((cycle) => cycle.side === 'left');
  const right = cycles.filter((cycle) => cycle.side === 'right');
  const mean = (items: readonly ShortWalkCycle[]) =>
    invalid || items.length === 0
      ? null
      : items.reduce((total, item) => total + item.endedAtMs - item.startedAtMs, 0) / items.length;
  const range = (side: AffectedSide) => {
    const angles = samples.flatMap((sample) => {
      const angle = shortWalkAngle(sample, side);
      return angle === null ? [] : [angle];
    });
    return invalid || angles.length === 0 ? null : Math.max(...angles) - Math.min(...angles);
  };
  const meanLeftCycleDurationMs = mean(left);
  const meanRightCycleDurationMs = mean(right);
  const leftKneeRange = range('left');
  const rightKneeRange = range('right');
  return {
    samples,
    cycles: invalid ? [] : cycles,
    leftCycles: invalid ? null : left.length,
    rightCycles: invalid ? null : right.length,
    meanLeftCycleDurationMs,
    meanRightCycleDurationMs,
    leftKneeRange,
    rightKneeRange,
    kneeRangeDifference:
      leftKneeRange === null || rightKneeRange === null ? null : leftKneeRange - rightKneeRange,
    cycleDurationDifferenceMs:
      meanLeftCycleDurationMs === null || meanRightCycleDurationMs === null
        ? null
        : meanLeftCycleDurationMs - meanRightCycleDurationMs,
  };
}
