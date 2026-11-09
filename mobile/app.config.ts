import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'PostureAssist',
  slug: 'postureassist',
  version: '0.1.0',
  scheme: 'postureassist',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['android', 'ios'],
  android: {
    package: 'com.postureassist.mobile',
    allowBackup: false,
    predictiveBackGestureEnabled: true,
    permissions: ['android.permission.CAMERA'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  ios: {
    bundleIdentifier: 'com.postureassist.mobile',
    supportsTablet: false,
  },
  plugins: ['expo-dev-client', './plugins/withAndroidBuildConfig.cjs'],
};

export default config;
