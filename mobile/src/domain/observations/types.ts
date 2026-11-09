import type { AffectedSide } from '../patients/types';
import type { RehabTaskId } from '../tasks/taskCatalog';

export type TaskStatus =
  | 'completed'
  | 'partial'
  | 'assisted'
  | 'unable'
  | 'not_attempted'
  | 'not_applicable'
  | 'stopped_safety';

export type CaptureQuality = 'valid' | 'degraded' | 'invalid_capture';

export interface ObservationSummary {
  readonly id: string;
  readonly patientId: string;
  readonly taskId: RehabTaskId;
  readonly taskName: string;
  readonly observedAt: string;
  readonly affectedSide: AffectedSide;
  readonly taskStatus: TaskStatus;
  readonly captureQuality: CaptureQuality;
  readonly repetitions: number | null;
  readonly durationMs: number;
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  completed: '已完成',
  partial: '部分完成',
  assisted: '辅助下完成',
  unable: '无法完成',
  not_attempted: '未尝试',
  not_applicable: '不适用',
  stopped_safety: '安全停止',
};

export const captureQualityLabels: Record<CaptureQuality, string> = {
  valid: '采集有效',
  degraded: '质量下降',
  invalid_capture: '无效采集',
};
