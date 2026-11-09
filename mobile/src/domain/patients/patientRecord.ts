import type { AbilityLevel, AffectedSide, PatientSummary } from './types';

export interface PatientProfile extends PatientSummary {
  readonly ageYears: number | null;
  readonly onsetDate: string | null;
  readonly abilityAssessor: string | null;
  readonly abilityAssessedOn: string | null;
  readonly consentRecordedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
}

export interface PatientDraft {
  readonly patientCode: string;
  readonly photoUri: string | null;
  readonly ageYears: string;
  readonly affectedSide: AffectedSide | null;
  readonly onsetDate: string;
  readonly abilityLevel: AbilityLevel | null;
  readonly abilityAssessor: string;
  readonly abilityAssessedOn: string;
  readonly hasConsent: boolean;
}

export interface PatientValues {
  readonly patientCode: string;
  readonly photoUri: string | null;
  readonly ageYears: number | null;
  readonly affectedSide: AffectedSide;
  readonly onsetDate: string | null;
  readonly abilityLevel: AbilityLevel | null;
  readonly abilityAssessor: string | null;
  readonly abilityAssessedOn: string | null;
  readonly hasConsent: true;
}

export type ValidationResult<T> =
  | { readonly isValid: true; readonly value: T }
  | { readonly isValid: false; readonly errors: Readonly<Record<string, string>> };

export function getLocalDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

export function isValidPastDate(value: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > today) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function createPatientDraft(patient?: PatientProfile): PatientDraft {
  return {
    patientCode: patient?.patientCode ?? '',
    photoUri: patient?.photoUri ?? null,
    ageYears: patient?.ageYears?.toString() ?? '',
    affectedSide: patient?.affectedSide ?? null,
    onsetDate: patient?.onsetDate ?? '',
    abilityLevel: patient?.abilityLevel ?? null,
    abilityAssessor: patient?.abilityAssessor ?? '',
    abilityAssessedOn: patient?.abilityAssessedOn ?? '',
    hasConsent: patient !== undefined,
  };
}

export function validatePatientDraft(
  draft: PatientDraft,
  today = getLocalDate(),
): ValidationResult<PatientValues> {
  const errors: Record<string, string> = {};
  const patientCode = draft.patientCode.normalize('NFKC').trim().toUpperCase();
  if (draft.photoUri !== null && !/^file:\/\/\/.+/.test(draft.photoUri)) {
    errors.photoUri = '请选择本机图片。';
  }
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(patientCode)) {
    errors.patientCode = '编号使用 2–32 位字母、数字、短横线或下划线。';
  }
  const age = draft.ageYears.trim();
  if (age && (!/^\d{1,3}$/.test(age) || Number(age) > 120)) {
    errors.ageYears = '年龄填写 0–120 的整数，未知时留空。';
  }
  if (draft.affectedSide !== 'left' && draft.affectedSide !== 'right') {
    errors.affectedSide = '请选择患侧。';
  }
  const onsetDate = draft.onsetDate.trim();
  if (onsetDate && !isValidPastDate(onsetDate, today)) {
    errors.onsetDate = '请填写有效日期 YYYY-MM-DD，不能晚于今天。';
  }
  const abilityAssessor = draft.abilityAssessor.trim();
  const abilityAssessedOn = draft.abilityAssessedOn.trim();
  if (draft.abilityLevel !== null) {
    if (!['mild', 'moderate', 'severe'].includes(draft.abilityLevel)) {
      errors.abilityLevel = '请选择有效的能力等级。';
    }
    if (!abilityAssessor || abilityAssessor.length > 60) {
      errors.abilityAssessor = '请填写评定者编号，最多 60 字。';
    }
    if (!isValidPastDate(abilityAssessedOn, today)) {
      errors.abilityAssessedOn = '请填写有效评定日期，不能晚于今天。';
    }
  }
  if (!draft.hasConsent) errors.hasConsent = '请先说明本地数据用途并取得患者授权。';
  if (Object.keys(errors).length > 0 || draft.affectedSide === null) {
    return { isValid: false, errors };
  }
  return {
    isValid: true,
    value: {
      patientCode,
      photoUri: draft.photoUri,
      ageYears: age ? Number(age) : null,
      affectedSide: draft.affectedSide,
      onsetDate: onsetDate || null,
      abilityLevel: draft.abilityLevel,
      abilityAssessor: draft.abilityLevel ? abilityAssessor : null,
      abilityAssessedOn: draft.abilityLevel ? abilityAssessedOn : null,
      hasConsent: true,
    },
  };
}
