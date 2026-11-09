import type { CameraPermission } from './cameraPermission';

export interface CaptureReadiness {
  readonly hasPatient: boolean;
  readonly requiresSafetyConfirmation: boolean;
  readonly hasSafetyConfirmation: boolean;
  readonly permission: CameraPermission;
  readonly isCameraReady: boolean;
  readonly isModelReady: boolean;
  readonly hasRequiredLandmarks: boolean;
  readonly isAppActive: boolean;
}

export type CaptureBlocker =
  | 'patient_missing'
  | 'safety_unconfirmed'
  | 'permission_missing'
  | 'camera_unavailable'
  | 'model_unavailable'
  | 'landmarks_missing'
  | 'app_inactive';

export function getCaptureBlockers(readiness: CaptureReadiness): readonly CaptureBlocker[] {
  const blockers: CaptureBlocker[] = [];

  if (!readiness.hasPatient) blockers.push('patient_missing');
  if (readiness.requiresSafetyConfirmation && !readiness.hasSafetyConfirmation) {
    blockers.push('safety_unconfirmed');
  }
  if (readiness.permission !== 'granted') blockers.push('permission_missing');
  if (!readiness.isCameraReady) blockers.push('camera_unavailable');
  if (!readiness.isModelReady) blockers.push('model_unavailable');
  if (!readiness.hasRequiredLandmarks) blockers.push('landmarks_missing');
  if (!readiness.isAppActive) blockers.push('app_inactive');

  return blockers;
}
