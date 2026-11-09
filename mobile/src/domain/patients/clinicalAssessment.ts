import { getLocalDate, isValidPastDate } from './patientRecord';
import type { ValidationResult } from './patientRecord';

export const assessmentScales = [
  { id: 'fma_upper', name: 'Fugl-Meyer 上肢运动', maxScore: 66 },
  { id: 'fma_lower', name: 'Fugl-Meyer 下肢运动', maxScore: 34 },
  { id: 'berg', name: 'Berg 平衡量表', maxScore: 56 },
  { id: 'barthel', name: 'Barthel 指数（100 分制）', maxScore: 100 },
] as const;

export type AssessmentScale = (typeof assessmentScales)[number]['id'];

export interface AssessmentDraft {
  readonly scale: AssessmentScale;
  readonly score: string;
  readonly assessedOn: string;
  readonly assessor: string;
  readonly notes: string;
}

export interface AssessmentValues {
  readonly scale: AssessmentScale;
  readonly score: number;
  readonly assessedOn: string;
  readonly assessor: string;
  readonly notes: string | null;
}

export interface ClinicalAssessment extends AssessmentValues {
  readonly id: string;
  readonly patientId: string;
  readonly createdAt: string;
}

export function createAssessmentDraft(current: ClinicalAssessment | null = null): AssessmentDraft {
  return {
    scale: current?.scale ?? 'fma_upper',
    score: current ? String(current.score) : '',
    assessedOn: current?.assessedOn ?? getLocalDate(),
    assessor: current?.assessor ?? '',
    notes: current?.notes ?? '',
  };
}

export function validateAssessmentDraft(
  draft: AssessmentDraft,
  today = getLocalDate(),
): ValidationResult<AssessmentValues> {
  const errors: Record<string, string> = {};
  const scale = assessmentScales.find((item) => item.id === draft.scale);
  const score = draft.score.trim();
  const assessor = draft.assessor.trim();
  const assessedOn = draft.assessedOn.trim();
  const notes = draft.notes.trim();
  if (!scale) errors.scale = '请选择有效的评估量表。';
  if (!scale || !/^\d{1,3}$/.test(score) || Number(score) > scale.maxScore) {
    errors.score = `请填写 0–${scale?.maxScore ?? 100} 的整数分数。`;
  }
  if (!isValidPastDate(assessedOn, today)) errors.assessedOn = '请填写有效日期，不能晚于今天。';
  if (!assessor || assessor.length > 60) errors.assessor = '请填写评估者编号，最多 60 字。';
  if (notes.length > 500) errors.notes = '备注最多 500 字。';
  if (Object.keys(errors).length > 0) return { isValid: false, errors };
  return {
    isValid: true,
    value: { scale: draft.scale, score: Number(score), assessedOn, assessor, notes: notes || null },
  };
}
