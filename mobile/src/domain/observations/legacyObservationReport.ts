import type { SafetyStopReason } from '../capture/legacyCaptureStatus';
import type { AngleAnalysis } from './angleAnalysis';
import type { AngleObservationTaskId } from './angleProtocols';
import type { ObservationSummary } from './types';

export interface ObservationReport extends ObservationSummary {
  readonly taskId: AngleObservationTaskId;
  readonly schemaVersion: 1;
  readonly patientCode: string;
  readonly patientRevision: number;
  readonly modelVersion: string;
  readonly protocolVersion: string;
  readonly analysisVersion: string;
  readonly cameraView: 'side';
  readonly assistance: 'none' | 'manual_or_device';
  readonly safetyStopReason: SafetyStopReason | null;
  readonly analysis: AngleAnalysis;
}
