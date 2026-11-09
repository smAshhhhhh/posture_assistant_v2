export interface SitToStandCycle {
  readonly startedAtMs: number;
  readonly standingAtMs: number;
  readonly descentStartedAtMs: number;
  readonly endedAtMs: number;
}

export interface SitToStandMetrics {
  readonly cycles: readonly SitToStandCycle[];
  readonly meanRiseDurationMs: number | null;
  readonly meanDescentDurationMs: number | null;
}

// 工程阈值以初始坐姿腿长归一化，不作为临床完成标准。
export const sitToStandSettings = {
  stableDurationMs: 300,
  movementAngle: 120,
  descentAngle: 145,
  movementHeight: 0.05,
  standingHeight: 0.15,
  seatedHeightTolerance: 0.1,
  footPositionTolerance: 0.12,
  legLengthTolerance: 0.2,
} as const;

export function summarizeSitToStand(cycles: readonly SitToStandCycle[]): SitToStandMetrics {
  const mean = (duration: (cycle: SitToStandCycle) => number) =>
    cycles.length === 0
      ? null
      : cycles.reduce((total, cycle) => total + duration(cycle), 0) / cycles.length;
  return {
    cycles,
    meanRiseDurationMs: mean((cycle) => cycle.standingAtMs - cycle.startedAtMs),
    meanDescentDurationMs: mean((cycle) => cycle.endedAtMs - cycle.descentStartedAtMs),
  };
}
