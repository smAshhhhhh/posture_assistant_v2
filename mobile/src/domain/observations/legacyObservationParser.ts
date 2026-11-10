import { rehabTasks } from '../tasks/taskCatalog';

import type { AngleAnalysis } from './angleAnalysis';
import {
  angleAnalysisSettings,
  getAngleObservationProtocol,
  isAngleObservationTask,
} from './angleProtocols';
import type { ObservationReport } from './legacyObservationReport';
import { readNumber, readObject, readString } from './recordValues';
import type { CaptureQuality, ObservationSummary, HistoricalTaskStatus } from './types';
import { parseSitToStandMetrics } from './sitToStandParser';
import { parseMarchInPlaceMetrics } from './marchInPlaceParser';
import { parseShortWalkMetrics } from './shortWalkParser';

function readQuality(value: unknown): CaptureQuality {
  if (value !== 'valid' && value !== 'degraded' && value !== 'invalid_capture') {
    throw new Error('采集质量字段不正确');
  }
  return value;
}

function readStatus(value: unknown): HistoricalTaskStatus {
  switch (value) {
    case 'completed':
    case 'partial':
    case 'assisted':
    case 'unable':
    case 'stopped_safety':
      return value;
    default:
      throw new Error('任务状态字段不正确');
  }
}

function nullableNumber(value: unknown, maximum: number): number | null {
  return value === null ? null : readNumber(value, 0, maximum);
}

export function parseObservationSummary(value: unknown): ObservationSummary {
  const record = readObject(value);
  const task = rehabTasks.find((item) => item.id === record.taskId);
  const side = record.affectedSide;
  const observedAt = readString(record.observedAt);
  if (!task || (side !== 'left' && side !== 'right') || !Number.isFinite(Date.parse(observedAt))) {
    throw new Error('观察记录字段不正确');
  }
  const captureQuality = readQuality(record.captureQuality);
  const repetitions = nullableNumber(record.repetitions, 9_000);
  if (
    repetitions !== null &&
    (!Number.isInteger(repetitions) || captureQuality === 'invalid_capture')
  ) {
    throw new Error('重复次数字段不正确');
  }
  return {
    id: readString(record.id),
    patientId: readString(record.patientId),
    taskId: task.id,
    taskName: task.name,
    affectedSide: side,
    observedAt,
    taskStatus: readStatus(record.taskStatus),
    captureQuality,
    repetitions,
    durationMs: readNumber(record.durationMs, 0, 86_400_000),
  };
}

export function parseLegacyAnalysis(value: unknown, durationMs: number): AngleAnalysis {
  const record = readObject(value);
  const captureQuality = readQuality(record.captureQuality);
  if (!Array.isArray(record.series) || record.series.length > 9_000)
    throw new Error('角度序列不正确');
  let previous = -1;
  const series = record.series.map((entry: unknown) => {
    const sample = readObject(entry);
    const timestampMs = readNumber(sample.timestampMs, 0, durationMs);
    const angle = nullableNumber(sample.angle, 180);
    if (timestampMs <= previous || (captureQuality === 'invalid_capture' && angle !== null)) {
      throw new Error('角度时序不正确');
    }
    previous = timestampMs;
    return {
      timestampMs,
      angle,
      ...(sample.segmentIndex === undefined
        ? {}
        : {
            segmentIndex: readNumber(sample.segmentIndex, 0, 9000),
          }),
    };
  });
  const minAngle = nullableNumber(record.minAngle, 180);
  const maxAngle = nullableNumber(record.maxAngle, 180);
  const rangeOfMotion = nullableNumber(record.rangeOfMotion, 180);
  const repetitions = nullableNumber(record.repetitions, 9_000);
  const validSampleCount = readNumber(record.validSampleCount, 0, record.series.length);
  const coverage = readNumber(record.coverage, 0, 1);
  const usableAngles = series.flatMap((sample) => (sample.angle === null ? [] : [sample.angle]));
  if (
    !Number.isInteger(validSampleCount) ||
    (captureQuality === 'invalid_capture' &&
      [minAngle, maxAngle, rangeOfMotion, repetitions].some((item) => item !== null)) ||
    (minAngle !== null && maxAngle !== null && minAngle > maxAngle) ||
    (captureQuality !== 'invalid_capture' &&
      (minAngle === null ||
        maxAngle === null ||
        rangeOfMotion === null ||
        repetitions === null ||
        !Number.isInteger(repetitions) ||
        validSampleCount !== usableAngles.length ||
        validSampleCount < angleAnalysisSettings.minimumSamples ||
        durationMs < angleAnalysisSettings.minimumDurationMs ||
        coverage < 0.5 ||
        Math.abs(rangeOfMotion - (maxAngle - minAngle)) > 1e-6 ||
        Math.abs(Math.min(...usableAngles) - minAngle) > 1e-6 ||
        Math.abs(Math.max(...usableAngles) - maxAngle) > 1e-6))
  ) {
    throw new Error('分析指标不正确');
  }
  return {
    captureQuality,
    minAngle,
    maxAngle,
    rangeOfMotion,
    repetitions,
    series,
    coverage,
    validSampleCount,
    longestGapMs: readNumber(record.longestGapMs, 0, durationMs),
  };
}

export function parseObservationReport(value: unknown): ObservationReport {
  const record = readObject(value);
  const summary = parseObservationSummary(value);
  const assistance = record.assistance;
  const reason = record.safetyStopReason;
  if (!isAngleObservationTask(summary.taskId)) throw new Error('观察任务不兼容');
  const protocol = getAngleObservationProtocol(summary.taskId);
  if (
    record.schemaVersion !== 1 ||
    record.cameraView !== 'side' ||
    record.protocolVersion !== protocol.version ||
    record.analysisVersion !== protocol.analysisVersion ||
    (summary.taskStatus === 'completed' && assistance !== 'none') ||
    (summary.taskStatus === 'assisted' && assistance !== 'manual_or_device') ||
    (assistance !== 'none' && assistance !== 'manual_or_device') ||
    (reason !== null &&
      reason !== 'pain' &&
      reason !== 'dizziness' &&
      reason !== 'fatigue' &&
      reason !== 'other') ||
    (reason !== null && summary.taskStatus !== 'stopped_safety')
  ) {
    throw new Error('观察报告不兼容');
  }
  const angleAnalysis = parseLegacyAnalysis(record.analysis, summary.durationMs);
  const rawAnalysis = readObject(record.analysis);
  if (summary.taskId !== 'sit_to_stand' && rawAnalysis.sitToStand !== undefined) {
    throw new Error('坐站阶段与任务不匹配');
  }
  if (summary.taskId !== 'march_in_place' && rawAnalysis.marchInPlace !== undefined) {
    throw new Error('踏步阶段与任务不匹配');
  }
  if (summary.taskId !== 'short_walk' && rawAnalysis.shortWalk !== undefined) {
    throw new Error('步行指标与任务不匹配');
  }
  let analysis: AngleAnalysis =
    summary.taskId === 'sit_to_stand'
      ? {
          ...angleAnalysis,
          sitToStand: parseSitToStandMetrics(
            rawAnalysis.sitToStand,
            angleAnalysis,
            summary.durationMs,
          ),
        }
      : summary.taskId === 'march_in_place'
        ? {
            ...angleAnalysis,
            marchInPlace: parseMarchInPlaceMetrics(
              rawAnalysis.marchInPlace,
              angleAnalysis,
              summary.durationMs,
            ),
          }
        : angleAnalysis;
  if (summary.taskId === 'short_walk') {
    analysis = {
      ...angleAnalysis,
      shortWalk: parseShortWalkMetrics(rawAnalysis.shortWalk, angleAnalysis, summary.affectedSide),
    };
  }
  const patientRevision = readNumber(record.patientRevision, 1);
  if (
    !Number.isInteger(patientRevision) ||
    analysis.captureQuality !== summary.captureQuality ||
    analysis.repetitions !== summary.repetitions
  ) {
    throw new Error('观察报告指标不一致');
  }
  return {
    ...summary,
    taskId: summary.taskId,
    schemaVersion: 1,
    cameraView: 'side',
    assistance,
    safetyStopReason: reason,
    analysis,
    patientCode: readString(record.patientCode),
    patientRevision,
    modelVersion: readString(record.modelVersion),
    protocolVersion: readString(record.protocolVersion),
    analysisVersion: readString(record.analysisVersion),
  };
}
