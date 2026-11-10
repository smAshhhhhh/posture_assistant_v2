import type { AngleAnalysis, AngleSample } from './angleAnalysis';
import type { AngleObservationTaskId } from './angleProtocols';
import { getAngleObservationProtocol } from './angleProtocols';
import type { SitToStandMetrics } from './sitToStandProtocol';
import type { MarchInPlaceMetrics } from './marchInPlaceProtocol';
import type { ShortWalkMetrics } from './shortWalkProtocol';
import type { CaptureQuality, TaskStatus } from './types';

export interface QualityAssessment {
  readonly captureQuality: CaptureQuality;
  readonly coverage: number;
  readonly validSampleCount: number;
  readonly longestGapMs: number;
}

export interface AngleMetrics {
  readonly minAngle: number | null;
  readonly maxAngle: number | null;
  readonly rangeOfMotion: number | null;
  readonly series: readonly AngleSample[];
}

interface TaskAnalysisBase {
  readonly recordingId: string;
  readonly protocolVersion: string;
  readonly analysisVersion: string;
  // 待确认及旧安全停止记录为空，不从识别结果推断患者完成情况。
  readonly taskStatus: TaskStatus | null;
  readonly qualityAssessment: QualityAssessment;
  readonly commonMetrics: {
    readonly durationMs: number;
    readonly repetitions: number | null;
  };
}

export interface JointAngleAnalysis {
  readonly angle: AngleMetrics;
}

export interface SitToStandAnalysis extends JointAngleAnalysis {
  readonly metrics: SitToStandMetrics;
}

export interface SteppingAnalysis extends JointAngleAnalysis {
  readonly metrics: MarchInPlaceMetrics;
}

export interface WalkingAnalysis extends JointAngleAnalysis {
  readonly metrics: ShortWalkMetrics;
}

export type TaskAnalysis = TaskAnalysisBase &
  (
    | {
        readonly taskId:
          | 'shoulder_flexion'
          | 'elbow_flexion_extension'
          | 'seated_trunk_lean'
          | 'seated_knee_extension';
        readonly taskResult: JointAngleAnalysis;
      }
    | { readonly taskId: 'sit_to_stand'; readonly taskResult: SitToStandAnalysis }
    | { readonly taskId: 'march_in_place'; readonly taskResult: SteppingAnalysis }
    | { readonly taskId: 'short_walk'; readonly taskResult: WalkingAnalysis }
  );

export function createTaskAnalysis(
  recordingId: string,
  durationMs: number,
  taskId: AngleObservationTaskId,
  taskStatus: TaskStatus | null,
  analysis: AngleAnalysis,
): TaskAnalysis {
  const protocol = getAngleObservationProtocol(taskId);
  const base: TaskAnalysisBase = {
    recordingId,
    taskStatus,
    protocolVersion: protocol.version,
    analysisVersion: protocol.analysisVersion,
    qualityAssessment: {
      captureQuality: analysis.captureQuality,
      coverage: analysis.coverage,
      validSampleCount: analysis.validSampleCount,
      longestGapMs: analysis.longestGapMs,
    },
    commonMetrics: { durationMs, repetitions: analysis.repetitions },
  };
  const angle: AngleMetrics = {
    minAngle: analysis.minAngle,
    maxAngle: analysis.maxAngle,
    rangeOfMotion: analysis.rangeOfMotion,
    series: analysis.series,
  };
  if (taskId === 'sit_to_stand') {
    if (!analysis.sitToStand) throw new Error('缺少坐站分析');
    return { ...base, taskId, taskResult: { angle, metrics: analysis.sitToStand } };
  }
  if (taskId === 'march_in_place') {
    if (!analysis.marchInPlace) throw new Error('缺少踏步分析');
    return { ...base, taskId, taskResult: { angle, metrics: analysis.marchInPlace } };
  }
  if (taskId === 'short_walk') {
    if (!analysis.shortWalk) throw new Error('缺少步行分析');
    return { ...base, taskId, taskResult: { angle, metrics: analysis.shortWalk } };
  }
  return { ...base, taskId, taskResult: { angle } };
}

// 展示与旧算法使用临时视图，持久化仅保存三层结构中的分析结果。
export function getAngleAnalysis(analysis: TaskAnalysis): AngleAnalysis {
  return {
    ...analysis.qualityAssessment,
    ...analysis.taskResult.angle,
    repetitions: analysis.commonMetrics.repetitions,
    ...(analysis.taskId === 'sit_to_stand' ? { sitToStand: analysis.taskResult.metrics } : {}),
    ...(analysis.taskId === 'march_in_place' ? { marchInPlace: analysis.taskResult.metrics } : {}),
    ...(analysis.taskId === 'short_walk' ? { shortWalk: analysis.taskResult.metrics } : {}),
  };
}
