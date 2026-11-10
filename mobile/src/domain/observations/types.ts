import type { AffectedSide } from '../patients/types';
import type { RehabTaskId } from '../tasks/taskCatalog';

export type TaskStatus = 'completed' | 'partial' | 'assisted' | 'unable';

// 旧安全停止结果保持原意，只允许读取。
export type HistoricalTaskStatus = TaskStatus | 'stopped_safety';

export type CaptureQuality = 'valid' | 'degraded' | 'invalid_capture';

export interface ObservationSummary {
  readonly id: string;
  readonly patientId: string;
  readonly taskId: RehabTaskId;
  readonly taskName: string;
  readonly observedAt: string;
  readonly affectedSide: AffectedSide;
  readonly taskStatus: HistoricalTaskStatus;
  readonly captureQuality: CaptureQuality;
  readonly repetitions: number | null;
  readonly durationMs: number;
}

export const taskStatusLabels: Record<HistoricalTaskStatus, string> = {
  completed: '已完成',
  partial: '部分完成',
  assisted: '辅助下完成',
  unable: '无法完成',
  stopped_safety: '安全停止',
};

export const captureQualityLabels: Record<CaptureQuality, string> = {
  valid: '采集有效',
  degraded: '质量下降',
  invalid_capture: '无效采集',
};
