import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import ts from 'typescript';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const parsers = await loadTypeScript('src/domain/settings/appPreferences.ts');
const source = await readFile('src/data/settings/preferencesRepository.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function repository(store) {
  const module = { exports: {} };
  const imports = new Map([
    ['expo', { requireOptionalNativeModule: () => store }],
    ['react-native', { Platform: { OS: 'android' } }],
    ['@/domain/settings/appPreferences', parsers],
  ]);
  const requireStub = (specifier) => {
    assert.ok(imports.has(specifier), `意外的仓储依赖：${specifier}`);
    return imports.get(specifier);
  };
  new Function('require', 'module', 'exports', compiled)(requireStub, module, module.exports);
  return module.exports.preferencesRepository;
}

test('旧原生包沿用 Lite，拒绝把 Full 或 Heavy 静默保存为 Lite', async () => {
  let writes = 0;
  const legacy = repository({
    dataManagementVersion: () => 1,
    getPreferences: async () =>
      JSON.stringify({ showSkeleton: false, showCaptureHints: true, defaultAssistance: false }),
    savePreferences: async (payload) => {
      writes++;
      return payload;
    },
  });
  assert.equal(legacy.canSelectPoseModel, false);
  assert.equal((await legacy.load()).poseModel, 'lite');
  for (const poseModel of ['full', 'heavy']) {
    await assert.rejects(legacy.save({ ...parsers.defaultAppPreferences, poseModel }));
  }
  assert.equal(writes, 0);
  await legacy.save(parsers.defaultAppPreferences);
  assert.equal(writes, 1);
});

test('新原生包保存后可重新读取所选模型，回读型号不同则拒绝报告成功', async () => {
  let payload = JSON.stringify(parsers.defaultAppPreferences);
  const native = {
    dataManagementVersion: () => 1,
    modelPreferencesVersion: () => 1,
    getPreferences: async () => payload,
    savePreferences: async (next) => {
      payload = next;
      return payload;
    },
  };
  const current = repository(native);
  assert.equal(current.canSelectPoseModel, true);
  for (const poseModel of ['lite', 'full', 'heavy']) {
    const expected = { ...parsers.defaultAppPreferences, poseModel };
    assert.deepEqual(await current.save(expected), expected);
    assert.deepEqual(await current.load(), expected);
  }
  const broken = repository({
    ...native,
    savePreferences: async () => JSON.stringify(parsers.defaultAppPreferences),
  });
  await assert.rejects(broken.save({ ...parsers.defaultAppPreferences, poseModel: 'full' }));
});
