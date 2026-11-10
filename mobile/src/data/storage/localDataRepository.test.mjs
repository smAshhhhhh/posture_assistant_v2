import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile('src/data/storage/localDataRepository.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function repository(store) {
  const module = { exports: {} };
  const imports = new Map([
    ['expo', { requireOptionalNativeModule: () => store }],
    ['react-native', { Platform: { OS: 'android' } }],
    ['@/domain/storage/localData', {}],
    ['@/domain/observations/observationParser', { parseObservationReport: (value) => value }],
    [
      '@/domain/observations/motionMetrics',
      { extractMotionMetrics: (analysis) => analysis.metrics },
    ],
  ]);
  new Function('require', 'module', 'exports', compiled)(
    (key) => {
      assert.ok(imports.has(key), key);
      return imports.get(key);
    },
    module,
    module.exports,
  );
  return module.exports.localDataRepository;
}

test('导出按所选患者读取报告及统一指标，并携带任务、协议与算法上下文', async () => {
  const calls = [];
  const reads = [];
  const metric = {
    definition: { id: 'short_walk/left_cycles/v1' },
    metric: { value: 0, availability: 'available' },
  };
  const measurementContext = {
    taskProtocol: { protocolId: 'short_walk/free-observation', protocolVersion: '1' },
    metricDefinitionVersion: 1,
    validationStatus: 'engineering_unvalidated',
  };
  const data = repository({
    dataManagementVersion: () => 1,
    metricExportVersion: () => 1,
    getExportReports: async (scope) => {
      reads.push(JSON.parse(scope));
      return JSON.stringify([
        {
          id: 'o1',
          taskId: 'short_walk',
          protocolVersion: 'p1',
          analysisVersion: 'a1',
          measurementContext,
          taskAnalysis: { metrics: [metric] },
        },
      ]);
    },
    exportLocalData: async (...args) => {
      calls.push(args);
      return 'saved';
    },
  });
  assert.equal(await data.export({ kind: 'patient', id: 'p1' }, false), 'saved');
  assert.deepEqual(reads, [{ kind: 'patient', id: 'p1' }]);
  assert.equal(calls[0][1], false);
  assert.deepEqual(JSON.parse(calls[0][2]), [
    {
      recordingId: 'o1',
      taskId: 'short_walk',
      protocolVersion: 'p1',
      analysisVersion: 'a1',
      measurementContext,
      metrics: [metric],
    },
  ]);
});

test('旧包缺少指标导出能力时明确提示更新，读取失败时不发送部分导出数据', async () => {
  const old = repository({ dataManagementVersion: () => 1 });
  await assert.rejects(old.export({ kind: 'all' }, true), { code: 'STORE_UNAVAILABLE' });
  for (const payload of ['{}', 'null', 'broken']) {
    const current = repository({
      dataManagementVersion: () => 1,
      metricExportVersion: () => 1,
      getExportReports: async () => payload,
      exportLocalData: async () => {
        assert.fail('不应导出部分数据');
      },
    });
    await assert.rejects(current.export({ kind: 'all' }, true));
  }
});
