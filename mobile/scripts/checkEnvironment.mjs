import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const versions = [
  ['Node.js', process.version],
  ['项目目录', process.cwd()],
];

for (const [name, value] of versions) {
  process.stdout.write(`${name}: ${value}\n`);
}

const javaResult = spawnSync('java', ['-version'], { encoding: 'utf8' });
process.stdout.write(`Java: ${javaResult.stderr?.split('\n')[0] ?? '未检测到'}\n`);

const sdkPath = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;

if (!sdkPath) {
  process.stdout.write('Android SDK: 未设置 ANDROID_HOME 或 ANDROID_SDK_ROOT\n');
  process.stdout.write('请在本机开发终端设置 SDK 路径，再执行原生构建。\n');
} else {
  process.stdout.write(`Android SDK: ${sdkPath}\n`);

  for (const directory of ['platforms', 'build-tools', 'ndk', 'cmake']) {
    const target = path.join(sdkPath, directory);
    const entries = existsSync(target) ? readdirSync(target).join(', ') : '未安装';
    process.stdout.write(`${directory}: ${entries}\n`);
  }
}

process.stdout.write(`原生工程: ${existsSync('android') ? '已生成' : '尚未生成'}\n`);
process.stdout.write('此命令仅核对本机环境，不下载或安装任何组件。\n');
