export type MarchSide = 'left' | 'right';

export interface MarchStep {
  readonly side: MarchSide;
  readonly segmentIndex: number;
  readonly startedAtMs: number;
  readonly peakAtMs: number;
  readonly endedAtMs: number;
  readonly liftRatio: number;
}

export interface MarchInPlaceMetrics {
  readonly steps: readonly MarchStep[];
  readonly leftSteps: number | null;
  readonly rightSteps: number | null;
  readonly alternationErrors: number | null;
  readonly meanStepDurationMs: number | null;
  readonly cadencePerMinute: number | null;
}

// 工程阈值用于区分抬脚与站立摆动，不是步态或临床完成标准。
export const marchInPlaceSettings = {
  baselineDurationMs: 500,
  standingKneeAngle: 140,
  baselinePositionTolerance: 0.025,
  liftRatio: 0.08,
  returnRatio: 0.03,
  minimumStepDurationMs: 150,
  maximumStepDurationMs: 3_000,
  minimumLegLengthPx: 12,
  maximumFootHorizontalDriftRatio: 0.3,
  maximumHipDriftRatio: 0.2,
  maximumLegScaleChange: 0.25,
} as const;

export function summarizeMarchInPlace(
  steps: readonly MarchStep[],
  activeDurationMs: number,
  isInvalid = false,
): MarchInPlaceMetrics {
  if (isInvalid) {
    return {
      steps: [],
      leftSteps: null,
      rightSteps: null,
      alternationErrors: null,
      meanStepDurationMs: null,
      cadencePerMinute: null,
    };
  }
  const leftSteps = steps.filter((step) => step.side === 'left').length;
  const rightSteps = steps.length - leftSteps;
  const meanStepDurationMs =
    steps.length === 0
      ? null
      : steps.reduce((total, step) => total + step.endedAtMs - step.startedAtMs, 0) / steps.length;
  const cadencePerMinute =
    steps.length === 0 || activeDurationMs <= 0 ? null : (steps.length * 60_000) / activeDurationMs;
  let alternationErrors = 0;
  for (let index = 1; index < steps.length; index += 1) {
    const current = steps[index];
    const previous = steps[index - 1];
    if (current?.segmentIndex === previous?.segmentIndex && current?.side === previous?.side) {
      alternationErrors += 1;
    }
  }
  return {
    steps,
    leftSteps,
    rightSteps,
    alternationErrors,
    meanStepDurationMs,
    cadencePerMinute,
  };
}
