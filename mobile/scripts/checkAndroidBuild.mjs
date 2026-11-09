import { existsSync } from 'node:fs';
import path from 'node:path';

const sdkPath = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
const requiredTools = [
  [
    'Android SDK Platform 37.0',
    ['platforms/android-37.0/android.jar', 'platforms/android-37/android.jar'],
  ],
  ['Android Build Tools 37.0.0', ['build-tools/37.0.0/source.properties']],
  ['NDK 27.1.12297006', ['ndk/27.1.12297006/source.properties']],
  ['CMake 3.30.5', ['cmake/3.30.5/source.properties']],
];

if (!sdkPath) {
  process.stderr.write('请先设置 ANDROID_HOME 或 ANDROID_SDK_ROOT，再执行 Android 构建。\n');
  process.exit(1);
}

const missing = requiredTools.filter(
  ([, relativePaths]) =>
    !relativePaths.some((relativePath) => existsSync(path.join(sdkPath, relativePath))),
);

if (missing.length > 0) {
  process.stderr.write('以下工具尚未安装，请在 Android Studio SDK Manager 中手动安装：\n');

  for (const [name] of missing) {
    process.stderr.write(`- ${name}\n`);
  }

  process.stderr.write('已停止构建，不自动下载缺失的 SDK 工具。\n');
  process.exit(1);
}

process.stdout.write('Android SDK 工具核对通过。首次构建仍需下载 Gradle 和 Maven 依赖。\n');
