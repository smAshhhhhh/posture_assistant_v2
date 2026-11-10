import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Posture Assistant',
  slug: 'postureassist',
  version: '0.1.0',
  icon: './assets/branding/app-icon.png',
  scheme: 'postureassist',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['android', 'ios'],
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/branding/adaptive-foreground.png',
      backgroundColor: '#F7FAFF',
    },
    package: 'com.postureassist.mobile',
    allowBackup: false,
    // 兼容 Android 13～15，将系统返回手势交给 React Navigation。
    predictiveBackGestureEnabled: false,
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
