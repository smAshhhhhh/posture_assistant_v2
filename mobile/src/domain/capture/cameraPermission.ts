export type CameraPermission = 'unknown' | 'granted' | 'denied' | 'blocked' | 'unavailable';

export interface CameraPermissionGateway {
  getStatus(): Promise<CameraPermission>;
  request(): Promise<CameraPermission>;
  openSettings(): Promise<void>;
}
