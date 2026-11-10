import type { CaptureSession } from '../capture/captureSession';
import type { PatientProfile } from '../patients/patientRecord';
import { rehabTasks } from '../tasks/taskCatalog';

import { createTaskAnalysis } from './taskAnalysis';
import type { TaskAnalysis } from './taskAnalysis';
import type { SafetyStopReason } from '../capture/legacyCaptureStatus';
import { getAngleObservationProtocol, isAngleObservationTask } from './angleProtocols';
import type { AngleObservationTaskId } from './angleProtocols';
import type { PoseRecording } from './poseRecording';
import { parsePoseRecording } from './poseRecording';
import type { ObservationVideo } from './observationVideo';
import type { ObservationSummary, TaskStatus } from './types';
import { analyzeObservation } from './observationAnalysis';
import { createMeasurementContext } from './measurementContext';
import type { MeasurementContext } from './measurementContext';

export type ConfirmedTaskStatus = 'completed' | 'partial' | 'assisted' | 'unable';

export interface ObservationReport extends ObservationSummary {
  readonly taskId: AngleObservationTaskId;
  readonly schemaVersion: 2 | 3;
  readonly measurementContext?: MeasurementContext;
  readonly patientCode: string;
  readonly patientRevision: number;
  readonly modelVersion: string;
  readonly protocolVersion: string;
  readonly analysisVersion: string;
  readonly cameraView: 'side';
  readonly assistance: 'none' | 'manual_or_device';
  // 旧记录只读保留；新报告不写入此字段。
  readonly legacySafetyStopReason?: SafetyStopReason | null;
  readonly taskAnalysis: TaskAnalysis;
  readonly sourceSchemaVersion?: 1;
}

export function createObservationReport(
  patient: PatientProfile,
  session: CaptureSession,
  recording: PoseRecording,
  status: ConfirmedTaskStatus | null,
  hasAssistance: boolean,
): ObservationReport {
  if (
    !isAngleObservationTask(session.context.taskId) ||
    session.context.patientId !== patient.id ||
    session.context.affectedSide !== patient.affectedSide ||
    patient.id.startsWith('design-') ||
    session.phase !== 'finished'
  )
    throw new Error('当前观察不能保存为动作观察报告');
  const taskId = session.context.taskId;
  const task = rehabTasks.find((item) => item.id === taskId);
  if (!task) throw new Error('观察任务不存在');
  const protocol = getAngleObservationProtocol(taskId);
  const taskStatus: TaskStatus | null = status === 'assisted' ? 'completed' : status;
  if (
    !taskStatus ||
    !['completed', 'partial', 'assisted', 'unable'].includes(taskStatus) ||
    (!hasAssistance && status === 'assisted')
  ) {
    throw new Error('请确认任务状态与实际辅助情况');
  }
  const validatedRecording = parsePoseRecording(recording);
  const analysis = analyzeObservation(validatedRecording, patient.affectedSide, taskId);
  const taskAnalysis = createTaskAnalysis(
    recording.id,
    recording.durationMs,
    taskId,
    taskStatus,
    analysis,
  );
  if (session.taskProtocol && session.taskProtocol.taskType !== taskId) {
    throw new Error('动作协议与本次任务不一致');
  }
  return {
    schemaVersion: 3,
    measurementContext: createMeasurementContext(
      taskAnalysis,
      patient.affectedSide,
      session.taskProtocol,
    ),
    id: recording.id,
    patientId: patient.id,
    patientCode: patient.patientCode,
    patientRevision: patient.revision,
    taskId,
    taskName: task.name,
    observedAt: recording.observedAt,
    affectedSide: patient.affectedSide,
    taskStatus,
    captureQuality: analysis.captureQuality,
    repetitions: analysis.repetitions,
    durationMs: recording.durationMs,
    modelVersion: recording.metadata.modelVersion,
    protocolVersion: protocol.version,
    analysisVersion: protocol.analysisVersion,
    cameraView: 'side',
    assistance: hasAssistance ? 'manual_or_device' : 'none',
    taskAnalysis,
  };
}

export interface ObservationRepository {
  readonly isAvailable: boolean;
  readonly canStoreVideo: boolean;
  supportsTask(taskId: AngleObservationTaskId): boolean;
  list(): Promise<readonly ObservationSummary[]>;
  get(id: string): Promise<ObservationReport>;
  getVideo(id: string): Promise<ObservationVideo | null>;
  save(report: ObservationReport, recording: PoseRecording): Promise<ObservationReport>;
}

export function getObservationErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'STORE_UNAVAILABLE') return '请重新构建安装包，加载观察存储模块。';
  if (code === 'NOT_FOUND') return '未找到这条观察记录，请返回刷新。';
  if (code === 'CONFLICT') return '这条记录已经保存，请返回历史记录查看。';
  if (code === 'DATA_CORRUPT') return '本机关键点文件缺失或校验失败，无法读取完整记录。';
  if (code === 'VIDEO_MISSING') return '本次视频文件缺失或未写入完成，请重试保存。';
  return '观察数据操作失败，请重试。';
}
