export type AffectedSide = 'left' | 'right';

export type AbilityLevel = 'mild' | 'moderate' | 'severe';

export interface PatientSummary {
  readonly id: string;
  readonly patientCode: string;
  readonly affectedSide: AffectedSide;
  readonly abilityLevel: AbilityLevel | null;
  readonly lastObservedAt: string | null;
}

export const affectedSideLabels: Record<AffectedSide, string> = {
  left: '左侧患侧',
  right: '右侧患侧',
};

export const abilityLevelLabels: Record<AbilityLevel, string> = {
  mild: '轻度',
  moderate: '中度',
  severe: '重度',
};
