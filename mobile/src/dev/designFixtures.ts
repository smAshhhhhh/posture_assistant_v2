import type { ObservationSummary } from '@/domain/observations/types';
import type { PatientSummary } from '@/domain/patients/types';

// 只供显式开启的开发预览使用，禁止写入正式仓储。
export const designPatients: readonly PatientSummary[] = [
  {
    id: 'design-patient-0086',
    patientCode: 'PA-0086',
    affectedSide: 'right',
    abilityLevel: 'mild',
    lastObservedAt: '2026-11-05T09:32:00+08:00',
  },
  {
    id: 'design-patient-0082',
    patientCode: 'PA-0082',
    affectedSide: 'left',
    abilityLevel: 'moderate',
    lastObservedAt: '2026-11-04T14:10:00+08:00',
  },
  {
    id: 'design-patient-0079',
    patientCode: 'PA-0079',
    affectedSide: 'right',
    abilityLevel: null,
    lastObservedAt: null,
  },
];

export const designObservations: readonly ObservationSummary[] = [
  {
    id: 'design-observation-1105',
    patientId: 'design-patient-0086',
    taskId: 'elbow_flexion_extension',
    taskName: '肘关节屈伸',
    observedAt: '2026-11-05T09:32:00+08:00',
    affectedSide: 'right',
    taskStatus: 'completed',
    captureQuality: 'valid',
    repetitions: 4,
    durationMs: 36_000,
  },
];
