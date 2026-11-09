import { assessmentScales } from './clinicalAssessment';
import type { ClinicalAssessment } from './clinicalAssessment';
import type { PatientProfile } from './patientRecord';

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('患者资料格式不正确');
  }
  return Object.fromEntries(Object.entries(value));
}

function readText(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('患者资料字段不正确');
  }
  return value;
}

function readNullableText(record: Record<string, unknown>, key: string): string | null {
  if (record[key] === null) return null;
  return readText(record, key);
}

export function parsePatientProfile(value: unknown): PatientProfile {
  const record = readRecord(value);
  const affectedSide = record.affectedSide;
  const abilityLevel = record.abilityLevel;
  const ageYears = record.ageYears;
  const revision = record.revision;
  if (
    (affectedSide !== 'left' && affectedSide !== 'right') ||
    (abilityLevel !== null &&
      abilityLevel !== 'mild' &&
      abilityLevel !== 'moderate' &&
      abilityLevel !== 'severe') ||
    (ageYears !== null &&
      (typeof ageYears !== 'number' ||
        !Number.isInteger(ageYears) ||
        ageYears < 0 ||
        ageYears > 120)) ||
    typeof revision !== 'number' ||
    !Number.isInteger(revision) ||
    revision < 1
  ) {
    throw new Error('患者资料字段不正确');
  }
  const abilityAssessor = readNullableText(record, 'abilityAssessor');
  const abilityAssessedOn = readNullableText(record, 'abilityAssessedOn');
  const photoUri = record.photoUri === undefined ? null : readNullableText(record, 'photoUri');
  if (photoUri !== null && !/^file:\/\/\/.+/.test(photoUri)) {
    throw new Error('患者照片地址不正确');
  }
  if (abilityLevel !== null && (!abilityAssessor || !abilityAssessedOn)) {
    throw new Error('专业评定缺少来源');
  }
  return {
    id: readText(record, 'id'),
    patientCode: readText(record, 'patientCode'),
    photoUri,
    affectedSide,
    abilityLevel,
    ageYears,
    revision,
    abilityAssessor,
    abilityAssessedOn,
    onsetDate: readNullableText(record, 'onsetDate'),
    lastObservedAt: readNullableText(record, 'lastObservedAt'),
    consentRecordedAt: readText(record, 'consentRecordedAt'),
    createdAt: readText(record, 'createdAt'),
    updatedAt: readText(record, 'updatedAt'),
  };
}

export function parseClinicalAssessment(value: unknown): ClinicalAssessment {
  const record = readRecord(value);
  const scale = assessmentScales.find((item) => item.id === record.scale);
  const score = record.score;
  if (
    !scale ||
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > scale.maxScore
  ) {
    throw new Error('专业评估字段不正确');
  }
  return {
    id: readText(record, 'id'),
    patientId: readText(record, 'patientId'),
    scale: scale.id,
    score,
    assessedOn: readText(record, 'assessedOn'),
    assessor: readText(record, 'assessor'),
    notes: readNullableText(record, 'notes'),
    createdAt: readText(record, 'createdAt'),
  };
}

export function parseRecordList<T>(value: unknown, parse: (item: unknown) => T): readonly T[] {
  if (!Array.isArray(value)) throw new Error('本机资料列表格式不正确');
  return value.map((item: unknown) => parse(item));
}
