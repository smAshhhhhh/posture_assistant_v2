export interface CaptureReadiness {
  readonly hasPatient: boolean;
  readonly hasSafetyConfirmation: boolean;
  readonly isAppActive: boolean;
}

export type CaptureBlocker = 'patient_missing' | 'safety_unconfirmed' | 'app_inactive';

export function getCaptureBlockers(readiness: CaptureReadiness): readonly CaptureBlocker[] {
  const blockers: CaptureBlocker[] = [];

  if (!readiness.hasPatient) blockers.push('patient_missing');
  // 入镜和识别质量留给结果分析，所有任务仅要求人工确认开始。
  if (!readiness.hasSafetyConfirmation) blockers.push('safety_unconfirmed');
  if (!readiness.isAppActive) blockers.push('app_inactive');

  return blockers;
}
