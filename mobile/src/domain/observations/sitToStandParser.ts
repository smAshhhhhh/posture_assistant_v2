import type { AngleAnalysis } from './angleAnalysis';
import { readNumber, readObject } from './poseRecording';
import { sitToStandSettings, summarizeSitToStand } from './sitToStandProtocol';
import type { SitToStandMetrics } from './sitToStandProtocol';

export function parseSitToStandMetrics(
  value: unknown,
  analysis: AngleAnalysis,
  durationMs: number,
): SitToStandMetrics {
  const record = readObject(value);
  if (!Array.isArray(record.cycles) || record.cycles.length > 9_000) {
    throw new Error('坐站阶段序列不正确');
  }
  const invalid = analysis.captureQuality === 'invalid_capture';
  if (record.cycles.length !== (invalid ? 0 : analysis.repetitions)) {
    throw new Error('坐站次数与阶段不一致');
  }
  let previousEnd = -1;
  const cycles = record.cycles.map((entry: unknown) => {
    const cycle = readObject(entry);
    const startedAtMs = readNumber(cycle.startedAtMs, 0, durationMs);
    const standingAtMs = readNumber(cycle.standingAtMs, 0, durationMs);
    const descentStartedAtMs = readNumber(cycle.descentStartedAtMs, 0, durationMs);
    const endedAtMs = readNumber(cycle.endedAtMs, 0, durationMs);
    if (
      startedAtMs <= previousEnd ||
      startedAtMs >= standingAtMs ||
      standingAtMs + sitToStandSettings.stableDurationMs > descentStartedAtMs ||
      descentStartedAtMs >= endedAtMs ||
      endedAtMs + sitToStandSettings.stableDurationMs > durationMs
    ) {
      throw new Error('坐站阶段时间不正确');
    }
    const confirmation = analysis.series.find(
      (sample) => sample.timestampMs >= endedAtMs + sitToStandSettings.stableDurationMs,
    );
    if (!confirmation) throw new Error('坐站阶段缺少稳定确认');
    const evidence = analysis.series.filter(
      (sample) =>
        sample.timestampMs >= startedAtMs && sample.timestampMs <= confirmation.timestampMs,
    );
    if (
      evidence[0]?.timestampMs !== startedAtMs ||
      ![standingAtMs, descentStartedAtMs, endedAtMs].every((time) =>
        evidence.some((sample) => sample.timestampMs === time),
      ) ||
      evidence.some(
        (sample, index) =>
          sample.angle === null ||
          (index > 0 && sample.timestampMs - (evidence[index - 1]?.timestampMs ?? 0) > 250),
      )
    ) {
      throw new Error('坐站阶段缺少连续测量');
    }
    previousEnd = confirmation.timestampMs;
    return { startedAtMs, standingAtMs, descentStartedAtMs, endedAtMs };
  });
  const expected = summarizeSitToStand(cycles);
  for (const key of ['meanRiseDurationMs', 'meanDescentDurationMs'] as const) {
    const actual = record[key] === null ? null : readNumber(record[key], 0, durationMs);
    const mean = expected[key];
    if (mean === null ? actual !== null : actual === null || Math.abs(mean - actual) > 1e-6) {
      throw new Error('坐站平均耗时不正确');
    }
  }
  return expected;
}
