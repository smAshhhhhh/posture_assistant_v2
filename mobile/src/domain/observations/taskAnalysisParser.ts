import type { AngleObservationTaskId } from './angleProtocols';
import { getAngleObservationProtocol } from './angleProtocols';
import { parseLegacyAnalysis } from './legacyObservationParser';
import { parseSitToStandMetrics } from './sitToStandParser';
import { parseMarchInPlaceMetrics } from './marchInPlaceParser';
import { parseShortWalkMetrics } from './shortWalkParser';
import { readInteger, readObject } from './recordValues';
import { createTaskAnalysis } from './taskAnalysis';
import type { TaskAnalysis } from './taskAnalysis';
import type { AffectedSide } from '../patients/types';
import type { TaskStatus } from './types';

export function parseTaskAnalysis(
  value: unknown,
  recordingId: string,
  taskId: AngleObservationTaskId,
  durationMs: number,
  taskStatus: TaskStatus,
  side: AffectedSide,
): TaskAnalysis {
  const record = readObject(value);
  const protocol = getAngleObservationProtocol(taskId);
  const common = readObject(record.commonMetrics);
  const result = readObject(record.taskResult);
  const quality = readObject(record.qualityAssessment);
  const angle = readObject(result.angle);
  if (
    Object.keys(common).some((key) => key !== 'durationMs' && key !== 'repetitions') ||
    Object.keys(quality).some(
      (key) => !['captureQuality', 'coverage', 'validSampleCount', 'longestGapMs'].includes(key),
    ) ||
    Object.keys(angle).some(
      (key) => !['minAngle', 'maxAngle', 'rangeOfMotion', 'series'].includes(key),
    )
  )
    throw new Error('分析分层字段不正确');
  if (Object.keys(result).some((key) => key !== 'angle' && key !== 'metrics')) {
    throw new Error('任务专用结果字段不正确');
  }
  if (
    record.recordingId !== recordingId ||
    record.taskId !== taskId ||
    record.taskStatus !== taskStatus ||
    common.durationMs !== durationMs ||
    record.protocolVersion !== protocol.version ||
    record.analysisVersion !== protocol.analysisVersion ||
    (taskId !== 'sit_to_stand' &&
      taskId !== 'march_in_place' &&
      taskId !== 'short_walk' &&
      'metrics' in result)
  )
    throw new Error('任务分析上下文不一致');
  let analysis = parseLegacyAnalysis(
    {
      ...quality,
      ...angle,
      repetitions: common.repetitions,
    },
    durationMs,
  );
  let previousSegment = 0;
  for (const sample of analysis.series) {
    const segmentIndex = readInteger(sample.segmentIndex, previousSegment, 8_999);
    readInteger(sample.timestampMs, 0, durationMs - 1);
    previousSegment = segmentIndex;
  }
  if (taskId === 'sit_to_stand') {
    analysis = {
      ...analysis,
      sitToStand: parseSitToStandMetrics(result.metrics, analysis, durationMs),
    };
  } else if (taskId === 'march_in_place') {
    analysis = {
      ...analysis,
      marchInPlace: parseMarchInPlaceMetrics(result.metrics, analysis, durationMs),
    };
  } else if (taskId === 'short_walk') {
    analysis = { ...analysis, shortWalk: parseShortWalkMetrics(result.metrics, analysis, side) };
  }
  return createTaskAnalysis(recordingId, durationMs, taskId, taskStatus, analysis);
}
