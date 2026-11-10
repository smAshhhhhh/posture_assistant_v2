import type { AffectedSide } from '../patients/types';

import type { AngleAnalysis } from './angleAnalysis';
import { angleAnalysisSettings } from './angleProtocols';
import { detectShortWalkCycles } from './shortWalkCycles';
import { shortWalkAngle, summarizeShortWalk } from './shortWalkProtocol';
import type { ShortWalkSample } from './shortWalkProtocol';
import { readNumber, readObject } from './poseRecording';

export function parseShortWalkMetrics(value: unknown, analysis: AngleAnalysis, side: AffectedSide) {
  const record = readObject(value);
  const invalid = analysis.captureQuality === 'invalid_capture';
  if (!Array.isArray(record.samples) || record.samples.length !== analysis.series.length) {
    throw new Error('步行双侧时序不一致');
  }
  let previousSegment = -1;
  let previousSample: ShortWalkSample | null = null;
  const samples = record.samples.map((entry: unknown, index): ShortWalkSample => {
    const raw = readObject(entry);
    const segmentIndex = readNumber(raw.segmentIndex, 0, 9_000);
    const timestampMs = readNumber(raw.timestampMs, 0);
    const leftKneeAngle = raw.leftKneeAngle === null ? null : readNumber(raw.leftKneeAngle, 0, 180);
    const rightKneeAngle =
      raw.rightKneeAngle === null ? null : readNumber(raw.rightKneeAngle, 0, 180);
    const hipOffsetRatio =
      raw.hipOffsetRatio === null ? null : readNumber(raw.hipOffsetRatio, -16_384, 16_384);
    const sample = { timestampMs, segmentIndex, leftKneeAngle, rightKneeAngle, hipOffsetRatio };
    const timeline = analysis.series[index];
    const missing = leftKneeAngle === null;
    const continuous =
      previousSample &&
      !missing &&
      previousSample.leftKneeAngle !== null &&
      (analysis.series[index - 1]?.segmentIndex === undefined ||
        analysis.series[index - 1]?.segmentIndex === timeline?.segmentIndex) &&
      timestampMs - previousSample.timestampMs <= angleAnalysisSettings.maxGapMs;
    if (
      !Number.isInteger(segmentIndex) ||
      segmentIndex < previousSegment ||
      timeline?.timestampMs !== timestampMs ||
      timeline.angle !== shortWalkAngle(sample, side) ||
      missing !== (rightKneeAngle === null) ||
      missing !== (hipOffsetRatio === null) ||
      (invalid && !missing) ||
      (continuous && segmentIndex !== previousSegment) ||
      (previousSample &&
        previousSample.leftKneeAngle !== null &&
        !missing &&
        !continuous &&
        segmentIndex <= previousSegment)
    )
      throw new Error('步行时序或分段不正确');
    previousSegment = segmentIndex;
    previousSample = sample;
    return sample;
  });
  const cycles = invalid ? [] : detectShortWalkCycles(samples);
  if (!Array.isArray(record.cycles) || record.cycles.length !== cycles.length) {
    throw new Error('步行周期不一致');
  }
  const rawCycles = record.cycles;
  cycles.forEach((expected, index) => {
    const actual = readObject(rawCycles[index]);
    if (actual.side !== expected.side) throw new Error('步行周期侧别不正确');
    for (const key of [
      'segmentIndex',
      'startedAtMs',
      'extensionAtMs',
      'endedAtMs',
      'confirmedAtMs',
      'travelRatio',
    ] as const) {
      if (Math.abs(readNumber(actual[key], 0) - expected[key]) > 1e-6) {
        throw new Error('步行周期与测量证据不符');
      }
    }
  });
  const expected = summarizeShortWalk(samples, cycles, invalid);
  for (const key of [
    'leftCycles',
    'rightCycles',
    'meanLeftCycleDurationMs',
    'meanRightCycleDurationMs',
    'leftKneeRange',
    'rightKneeRange',
    'kneeRangeDifference',
    'cycleDurationDifferenceMs',
  ] as const) {
    const actual = record[key] === null ? null : readNumber(record[key], -86_400_000, 86_400_000);
    const correct = expected[key];
    if (correct === null ? actual !== null : actual === null || Math.abs(actual - correct) > 1e-6) {
      throw new Error('步行汇总指标不一致');
    }
  }
  if (analysis.repetitions !== (side === 'left' ? expected.leftCycles : expected.rightCycles)) {
    throw new Error('步行周期与摘要不一致');
  }
  return expected;
}
