import type { AngleAnalysis } from './angleAnalysis';
import { angleAnalysisSettings } from './angleProtocols';
import { marchInPlaceSettings as settings, summarizeMarchInPlace } from './marchInPlaceProtocol';
import type { MarchStep } from './marchInPlaceProtocol';
import { readNumber, readObject } from './poseRecording';

export function parseMarchInPlaceMetrics(
  value: unknown,
  analysis: AngleAnalysis,
  durationMs: number,
) {
  const record = readObject(value);
  const invalid = analysis.captureQuality === 'invalid_capture';
  if (
    !Array.isArray(record.steps) ||
    record.steps.length > 9_000 ||
    record.steps.length !== (invalid ? 0 : analysis.repetitions)
  )
    throw new Error('踏步次数与阶段不一致');
  let previousEnd = -1;
  let previousSegment = -1;
  const steps = record.steps.map((entry: unknown): MarchStep => {
    const step = readObject(entry);
    const side = step.side;
    const segmentIndex = readNumber(step.segmentIndex, 0, 9_000);
    const startedAtMs = readNumber(step.startedAtMs, 0, durationMs);
    const peakAtMs = readNumber(step.peakAtMs, 0, durationMs);
    const endedAtMs = readNumber(step.endedAtMs, 0, durationMs);
    const liftRatio = readNumber(step.liftRatio, settings.liftRatio, 1);
    const elapsed = endedAtMs - startedAtMs;
    if (
      (side !== 'left' && side !== 'right') ||
      !Number.isInteger(segmentIndex) ||
      segmentIndex < previousSegment ||
      startedAtMs <= previousEnd ||
      peakAtMs < startedAtMs ||
      peakAtMs >= endedAtMs ||
      elapsed < settings.minimumStepDurationMs ||
      elapsed > settings.maximumStepDurationMs
    )
      throw new Error('踏步阶段时间不正确');
    let preparationStart: number | undefined;
    for (const sample of analysis.series) {
      if (sample.timestampMs <= startedAtMs - settings.baselineDurationMs) {
        preparationStart = sample.timestampMs;
      }
    }
    const betweenSteps = analysis.series.filter(
      (sample) => sample.timestampMs >= previousEnd && sample.timestampMs <= startedAtMs,
    );
    const hasBreak = betweenSteps.some(
      (sample, index) =>
        sample.angle === null ||
        (index > 0 && sample.segmentIndex !== betweenSteps[index - 1]?.segmentIndex) ||
        (index > 0 &&
          sample.timestampMs - (betweenSteps[index - 1]?.timestampMs ?? 0) >
            angleAnalysisSettings.maxGapMs),
    );
    if (previousSegment >= 0 && segmentIndex !== previousSegment && !hasBreak) {
      throw new Error('踏步分段缺少中断依据');
    }
    const evidenceStart = segmentIndex === previousSegment ? previousEnd : preparationStart;
    if (evidenceStart === undefined) throw new Error('踏步阶段缺少站立准备');
    const evidence = analysis.series.filter(
      (sample) => sample.timestampMs >= evidenceStart && sample.timestampMs <= endedAtMs,
    );
    if (
      ![startedAtMs, peakAtMs, endedAtMs].every((time) =>
        evidence.some((sample) => sample.timestampMs === time),
      ) ||
      evidence.some(
        (sample, index) =>
          sample.angle === null ||
          (index > 0 && sample.segmentIndex !== evidence[index - 1]?.segmentIndex) ||
          (index > 0 &&
            sample.timestampMs - (evidence[index - 1]?.timestampMs ?? 0) >
              angleAnalysisSettings.maxGapMs),
      )
    )
      throw new Error('踏步阶段缺少连续测量');
    previousEnd = endedAtMs;
    previousSegment = segmentIndex;
    return { side, segmentIndex, startedAtMs, peakAtMs, endedAtMs, liftRatio };
  });
  const expected = summarizeMarchInPlace(steps, durationMs, invalid);
  for (const key of [
    'leftSteps',
    'rightSteps',
    'alternationErrors',
    'meanStepDurationMs',
    'cadencePerMinute',
  ] as const) {
    const actual = record[key] === null ? null : readNumber(record[key], 0);
    const correct = expected[key];
    if (correct === null ? actual !== null : actual === null || Math.abs(actual - correct) > 1e-6) {
      throw new Error('踏步汇总指标不一致');
    }
  }
  return expected;
}
