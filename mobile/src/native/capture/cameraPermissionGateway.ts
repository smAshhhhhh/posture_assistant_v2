import { Linking, PermissionsAndroid, Platform } from 'react-native';

import type { CameraPermission, CameraPermissionGateway } from '@/domain/capture/cameraPermission';

let lastPermission: CameraPermission = 'unknown';

export const cameraPermissionGateway: CameraPermissionGateway = {
  async getStatus() {
    if (Platform.OS !== 'android') return 'unavailable';

    const isGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    if (isGranted) {
      lastPermission = 'granted';
    } else if (lastPermission === 'granted') {
      lastPermission = 'denied';
    }

    return lastPermission;
  },
  async request() {
    if (Platform.OS !== 'android') return 'unavailable';

    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
    switch (result) {
      case PermissionsAndroid.RESULTS.GRANTED:
        lastPermission = 'granted';
        break;
      case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
        lastPermission = 'blocked';
        break;
      default:
        lastPermission = 'denied';
    }

    return lastPermission;
  },
  async openSettings() {
    await Linking.openSettings();
  },
};
