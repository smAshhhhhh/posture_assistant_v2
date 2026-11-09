import type { AffectedSide } from '../patients/types';

import { angleAnalysisSettings } from './angleProtocols';
import { shortWalkAngle, shortWalkSettings as settings } from './shortWalkProtocol';
import type { ShortWalkCycle, ShortWalkSample } from './shortWalkProtocol';

interface Swing {
  readonly peak: ShortWalkSample;
  readonly minimum: number;
  readonly extensionAtMs: number;
}

export function getWalkTravel(samples: readonly ShortWalkSample[]): number | null {
  const first = samples[0]?.hipOffsetRatio;
  const last = samples[samples.length - 1]?.hipOffsetRatio;
  if (first == null || last == null) return null;
  const travel = last - first;
  if (Math.abs(travel) < settings.minimumTravelRatio) return null;
  let backward = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const before = samples[index - 1]?.hipOffsetRatio;
    const after = samples[index]?.hipOffsetRatio;
    if (before == null || after == null) return null;
    backward += Math.max(0, -Math.sign(travel) * (after - before));
  }
  return backward <= settings.maximumBackwardRatio ? Math.abs(travel) : null;
}

export function detectShortWalkCycles(
  samples: readonly ShortWalkSample[],
): readonly ShortWalkCycle[] {
  const cycles: ShortWalkCycle[] = [];
  for (const side of ['left', 'right'] as const) {
    cycles.push(...detectSideCycles(samples, side));
  }
  return cycles.sort((a, b) => a.endedAtMs - b.endedAtMs || a.side.localeCompare(b.side));
}

function detectSideCycles(samples: readonly ShortWalkSample[], side: AffectedSide) {
  const cycles: ShortWalkCycle[] = [];
  let armed = false;
  let candidate: Swing | null = null;
  let previousSwing: Swing | null = null;
  let previousSample: ShortWalkSample | null = null;
  for (const sample of samples) {
    const angle = shortWalkAngle(sample, side);
    if (
      angle === null ||
      !previousSample ||
      previousSample.segmentIndex !== sample.segmentIndex ||
      sample.timestampMs - previousSample.timestampMs > angleAnalysisSettings.maxGapMs
    ) {
      armed = false;
      candidate = null;
      previousSwing = null;
    }
    previousSample = sample;
    if (angle === null) continue;
    if (angle >= settings.extendedAngle) {
      if (candidate && candidate.minimum <= settings.flexedAngle) {
        const completed = { ...candidate, extensionAtMs: sample.timestampMs };
        if (previousSwing) {
          const previousPeakMs = previousSwing.peak.timestampMs;
          const elapsed = completed.peak.timestampMs - previousSwing.peak.timestampMs;
          const evidence = samples.filter(
            (point) =>
              point.timestampMs >= previousPeakMs &&
              point.timestampMs <= completed.peak.timestampMs,
          );
          const travelRatio = getWalkTravel(evidence);
          const opposite = side === 'left' ? 'right' : 'left';
          const oppositeAtStart = shortWalkAngle(previousSwing.peak, opposite);
          const oppositeAtEnd = shortWalkAngle(completed.peak, opposite);
          if (
            elapsed >= settings.minimumCycleDurationMs &&
            elapsed <= settings.maximumCycleDurationMs &&
            travelRatio !== null &&
            oppositeAtStart !== null &&
            oppositeAtStart >= settings.extendedAngle &&
            oppositeAtEnd !== null &&
            oppositeAtEnd >= settings.extendedAngle
          ) {
            cycles.push({
              side,
              segmentIndex: sample.segmentIndex,
              startedAtMs: previousSwing.peak.timestampMs,
              extensionAtMs: previousSwing.extensionAtMs,
              endedAtMs: completed.peak.timestampMs,
              confirmedAtMs: sample.timestampMs,
              travelRatio,
            });
          }
        }
        previousSwing = completed;
      }
      candidate = null;
      armed = true;
    } else if (armed) {
      if (!candidate || angle < candidate.minimum) {
        candidate = { peak: sample, minimum: angle, extensionAtMs: 0 };
      }
      if (
        previousSwing &&
        sample.timestampMs - previousSwing.peak.timestampMs > settings.maximumCycleDurationMs
      ) {
        previousSwing = null;
      }
    }
  }
  return cycles;
}
