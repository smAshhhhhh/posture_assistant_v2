import { readInteger, readObject, readString } from './recordValues';
import {
  parseObservationReport as parseLegacyReport,
  parseObservationSummary,
} from './legacyObservationParser';
import { isAngleObservationTask } from './angleProtocols';
import type { ObservationReport } from './observationReport';
import { createTaskAnalysis } from './taskAnalysis';
import { parseTaskAnalysis } from './taskAnalysisParser';
import { parseMeasurementContext } from './measurementContext';

export { parseObservationSummary } from './legacyObservationParser';

export function parseObservationReport(value: unknown): ObservationReport {
  const record = readObject(value);
  if (record.schemaVersion === 1) {
    const legacy = parseLegacyReport(value);
    const { analysis, safetyStopReason, ...summary } = legacy;
    return {
      ...summary,
      schemaVersion: 2,
      sourceSchemaVersion: 1,
      legacySafetyStopReason: safetyStopReason,
      taskAnalysis: createTaskAnalysis(
        legacy.id,
        legacy.durationMs,
        legacy.taskId,
        legacy.taskStatus === 'stopped_safety' ? null : legacy.taskStatus,
        analysis,
      ),
    };
  }
  const summary = parseObservationSummary(value);
  if (
    (record.schemaVersion !== 2 && record.schemaVersion !== 3) ||
    record.cameraView !== 'side' ||
    summary.taskStatus === 'stopped_safety' ||
    !isAngleObservationTask(summary.taskId) ||
    (record.assistance !== 'none' && record.assistance !== 'manual_or_device') ||
    (record.schemaVersion === 2 &&
      summary.taskStatus === 'completed' &&
      record.assistance !== 'none') ||
    (summary.taskStatus === 'assisted' && record.assistance !== 'manual_or_device') ||
    (record.schemaVersion === 3 && summary.taskStatus === 'assisted') ||
    'analysis' in record ||
    'safetyStopReason' in record ||
    'sourceSchemaVersion' in record ||
    'legacySafetyStopReason' in record
  )
    throw new Error('观察报告不兼容');
  const taskAnalysis = parseTaskAnalysis(
    record.taskAnalysis,
    summary.id,
    summary.taskId,
    summary.durationMs,
    summary.taskStatus,
    summary.affectedSide,
  );
  if (
    taskAnalysis.qualityAssessment.captureQuality !== summary.captureQuality ||
    taskAnalysis.commonMetrics.repetitions !== summary.repetitions ||
    record.protocolVersion !== taskAnalysis.protocolVersion ||
    record.analysisVersion !== taskAnalysis.analysisVersion
  )
    throw new Error('观察报告指标不一致');
  return {
    ...summary,
    taskId: summary.taskId,
    schemaVersion: record.schemaVersion,
    ...(record.schemaVersion === 3
      ? { measurementContext: parseMeasurementContext(record.measurementContext, taskAnalysis) }
      : {}),
    patientCode: readString(record.patientCode),
    patientRevision: readInteger(record.patientRevision, 1),
    modelVersion: readString(record.modelVersion),
    protocolVersion: taskAnalysis.protocolVersion,
    analysisVersion: taskAnalysis.analysisVersion,
    cameraView: 'side',
    assistance: record.assistance,
    taskAnalysis,
  };
}
