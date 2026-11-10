import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import ts from 'typescript';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';
import { walkRecording } from '../../domain/observations/shortWalkFixtures.mjs';
import { createObservationReport } from '../../domain/observations/recordingFixtures.mjs';

const parsers = await loadTypeScript('src/domain/observations/observationParser.ts');
const videoParsers = await loadTypeScript('src/domain/observations/observationVideo.ts');
const source = await readFile('src/data/observations/observationRepository.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const pose = {
  schemaVersion: 1,
  id: '12345678-1234-4234-8234-123456789abc',
  observedAt: '2026-11-09T10:00:00.000Z',
  modelVersion: 'pose_landmarker_lite/float16/1',
  durationMs: 0,
  isTruncated: false,
  frames: [],
};
const patient = { id: 'patient-1', patientCode: 'PA-01', affectedSide: 'left', revision: 1 };

function report(taskId) {
  return createObservationReport(
    patient,
    {
      phase: 'finished',
      context: { taskId, patientId: patient.id, affectedSide: 'left' },
      safetyStopReason: null,
    },
    pose,
    'partial',
    false,
  );
}

function repository(store) {
  const module = { exports: {} };
  const imports = new Map([
    ['expo', { requireOptionalNativeModule: () => store }],
    ['react-native', { Platform: { OS: 'android' } }],
    ['@/domain/observations/observationParser', parsers],
    ['@/domain/observations/observationVideo', videoParsers],
  ]);
  const requireStub = (specifier) => {
    assert.ok(imports.has(specifier), `意外的仓储依赖：${specifier}`);
    return imports.get(specifier);
  };
  new Function('require', 'module', 'exports', compiled)(requireStub, module, module.exports);
  return module.exports.observationRepository;
}

test('旧包仍可回读历史，但缺少新版数据契约时不放行新采集', async () => {
  const none = repository(null);
  assert.equal(none.supportsTask('seated_trunk_lean'), false);
  const elbowOnly = repository({ observationVersion: () => 1 });
  assert.equal(elbowOnly.supportsTask('elbow_flexion_extension'), false);
  assert.equal(elbowOnly.supportsTask('shoulder_flexion'), false);
  assert.equal(elbowOnly.supportsTask('seated_knee_extension'), false);
  const previous = repository({ observationVersion: () => 1, jointObservationVersion: () => 1 });
  for (const taskId of ['elbow_flexion_extension', 'shoulder_flexion', 'seated_knee_extension']) {
    assert.equal(previous.supportsTask(taskId), false);
  }
  assert.equal(previous.supportsTask('seated_trunk_lean'), false);
  await assert.rejects(previous.save(report('seated_trunk_lean'), pose), {
    code: 'STORE_UNAVAILABLE',
  });
});

test('新版原生模块接收躯干报告和关键点，保存回执可重新读取', async () => {
  const expected = report('seated_trunk_lean');
  const saved = [];
  const current = repository({
    observationContractVersion: () => 2,
    observationVersion: () => 1,
    jointObservationVersion: () => 1,
    trunkObservationVersion: () => 1,
    saveObservation: async (reportJson, poseJson) => {
      saved.push(JSON.parse(reportJson), JSON.parse(poseJson));
      return reportJson;
    },
    getObservation: async () => JSON.stringify(expected),
    listObservations: async () => JSON.stringify([expected]),
  });
  assert.equal(current.supportsTask('seated_trunk_lean'), true);
  assert.deepEqual(await current.save(expected, pose), expected);
  assert.deepEqual(saved, [expected, pose]);
  assert.deepEqual(await current.get(expected.id), expected);
  assert.equal((await current.list())[0].taskId, 'seated_trunk_lean');
});

test('旧存储包不能丢弃视频后静默保存，新版保留录像并可读取回放信息', async () => {
  const recording = {
    ...pose,
    video: { segments: [{ fileName: `${pose.id}-0.mp4`, durationMs: 1000 }], error: null },
  };
  const expected = report('elbow_flexion_extension');
  const previous = repository({ observationVersion: () => 1 });
  assert.equal(previous.canStoreVideo, false);
  await assert.rejects(previous.save(expected, recording), { code: 'STORE_UNAVAILABLE' });
  const video = {
    bytes: 100,
    isPartial: false,
    segments: [{ uri: 'file:///data/user/0/app/files/video.mp4', durationMs: 1000 }],
  };
  const current = repository({
    observationContractVersion: () => 2,
    observationVersion: () => 1,
    observationVideoVersion: () => 1,
    saveObservation: async (reportJson, recordingJson) => {
      assert.deepEqual(JSON.parse(recordingJson), recording);
      return reportJson;
    },
    getObservationVideo: async () => JSON.stringify(video),
  });
  assert.equal(current.canStoreVideo, true);
  assert.deepEqual(await current.save(expected, recording), expected);
  assert.deepEqual(await current.getVideo(pose.id), video);
});

test('坐站能力独立检查，旧包拒绝保存，新版可保存并回读且保留视频', async () => {
  const previous = repository({
    observationVersion: () => 1,
    jointObservationVersion: () => 1,
    trunkObservationVersion: () => 1,
    observationVideoVersion: () => 1,
  });
  assert.equal(previous.supportsTask('sit_to_stand'), false);
  await assert.rejects(previous.save(report('sit_to_stand'), pose), { code: 'STORE_UNAVAILABLE' });
  const expected = report('sit_to_stand');
  const recording = { ...pose, video: { segments: [], error: 'recording_failed' } };
  const current = repository({
    observationContractVersion: () => 2,
    observationVersion: () => 1,
    sitToStandObservationVersion: () => 1,
    observationVideoVersion: () => 1,
    saveObservation: async (reportJson, poseJson) => {
      assert.deepEqual(JSON.parse(poseJson), recording);
      return reportJson;
    },
    getObservation: async () => JSON.stringify(expected),
    listObservations: async () => JSON.stringify([expected]),
  });
  assert.equal(current.supportsTask('sit_to_stand'), true);
  assert.deepEqual(await current.save(expected, recording), expected);
  assert.deepEqual(await current.get(pose.id), expected);
  assert.equal((await current.list())[0].taskId, 'sit_to_stand');
});

test('踏步能力独立检查，旧坐站包不能保存，新版保存报告与视频后可回读', async () => {
  const previous = repository({
    observationVersion: () => 1,
    jointObservationVersion: () => 1,
    trunkObservationVersion: () => 1,
    sitToStandObservationVersion: () => 1,
    observationVideoVersion: () => 1,
  });
  assert.equal(previous.supportsTask('march_in_place'), false);
  await assert.rejects(previous.save(report('march_in_place'), pose), {
    code: 'STORE_UNAVAILABLE',
  });
  const expected = report('march_in_place');
  const recording = {
    ...pose,
    video: { segments: [{ fileName: `${pose.id}-0.mp4`, durationMs: 1000 }], error: null },
  };
  const video = {
    bytes: 100,
    isPartial: false,
    segments: [{ uri: 'file:///data/user/0/app/files/march.mp4', durationMs: 1000 }],
  };
  const current = repository({
    observationContractVersion: () => 2,
    observationVersion: () => 1,
    marchObservationVersion: () => 1,
    observationVideoVersion: () => 1,
    saveObservation: async (reportJson, poseJson) => {
      assert.deepEqual(JSON.parse(poseJson), recording);
      return reportJson;
    },
    getObservation: async () => JSON.stringify(expected),
    listObservations: async () => JSON.stringify([expected]),
    getObservationVideo: async () => JSON.stringify(video),
  });
  assert.equal(current.supportsTask('march_in_place'), true);
  assert.deepEqual(await current.save(expected, recording), expected);
  assert.deepEqual(await current.get(pose.id), expected);
  assert.equal((await current.list())[0].taskId, 'march_in_place');
  assert.deepEqual(await current.getVideo(pose.id), video);
});

test('步行能力独立检查，旧踏步包不能保存，新版保存报告和视频后可回读', async () => {
  const previous = repository({
    observationVersion: () => 1,
    jointObservationVersion: () => 1,
    trunkObservationVersion: () => 1,
    sitToStandObservationVersion: () => 1,
    marchObservationVersion: () => 1,
    observationVideoVersion: () => 1,
  });
  assert.equal(previous.supportsTask('short_walk'), false);
  await assert.rejects(previous.save(report('short_walk'), pose), { code: 'STORE_UNAVAILABLE' });
  const walk = walkRecording();
  const expected = createObservationReport(
    patient,
    {
      phase: 'finished',
      context: { taskId: 'short_walk', patientId: patient.id, affectedSide: 'left' },
      safetyStopReason: null,
    },
    walk,
    'completed',
    false,
  );
  const recording = {
    ...walk,
    video: { segments: [{ fileName: `${pose.id}-0.mp4`, durationMs: 1000 }], error: null },
  };
  const video = {
    bytes: 100,
    isPartial: false,
    segments: [{ uri: 'file:///data/user/0/app/files/walk.mp4', durationMs: 1000 }],
  };
  const current = repository({
    observationContractVersion: () => 2,
    observationVersion: () => 1,
    shortWalkObservationVersion: () => 1,
    observationVideoVersion: () => 1,
    saveObservation: async (reportJson, poseJson) => {
      assert.deepEqual(JSON.parse(poseJson), recording);
      return reportJson;
    },
    getObservation: async () => JSON.stringify(expected),
    listObservations: async () => JSON.stringify([expected]),
    getObservationVideo: async () => JSON.stringify(video),
  });
  assert.equal(current.supportsTask('short_walk'), true);
  assert.deepEqual(await current.save(expected, recording), expected);
  assert.deepEqual(await current.get(pose.id), expected);
  assert.equal((await current.list())[0].taskId, 'short_walk');
  assert.deepEqual(await current.getVideo(pose.id), video);
});
