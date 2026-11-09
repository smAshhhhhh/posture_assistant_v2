import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import ts from 'typescript';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const parsers = await loadTypeScript('src/domain/patients/recordParser.ts');
const source = await readFile('src/data/patients/patientRepository.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const current = {
  id: 'assessment-1',
  patientId: 'patient-1',
  scale: 'berg',
  score: 0,
  assessedOn: '2026-11-09',
  assessor: 'T-03',
  notes: null,
  createdAt: '2026-11-09T10:00:00.000Z',
};
const values = {
  scale: 'barthel',
  score: 100,
  assessedOn: '2026-11-08',
  assessor: 'T-04',
  notes: '更正录入',
};

test('旧安装包拒绝带照片的保存，无照片保存仍可使用', async () => {
  let payload;
  const storedPatient = {
    id: 'patient-1',
    patientCode: 'PA-01',
    ageYears: null,
    affectedSide: 'left',
    abilityLevel: null,
    abilityAssessor: null,
    abilityAssessedOn: null,
    onsetDate: null,
    lastObservedAt: null,
    consentRecordedAt: current.createdAt,
    createdAt: current.createdAt,
    updatedAt: current.createdAt,
    revision: 1,
  };
  const legacy = repository({
    save: async (value) => {
      payload = JSON.parse(value);
      return JSON.stringify(storedPatient);
    },
  });
  await assert.rejects(legacy.save({ photoUri: 'file:///cache/photo.jpg' }, null), {
    code: 'PHOTO_UNAVAILABLE',
  });
  assert.equal(payload, undefined);
  assert.equal((await legacy.save({ photoUri: null }, null)).photoUri, null);
  assert.equal(payload.photoUri, null);
  const photoUri = 'file:///files/patient-photos/photo.jpg';
  const modern = repository({
    patientPhotoVersion: () => 1,
    save: async () => JSON.stringify({ ...storedPatient, photoUri }),
  });
  assert.equal(
    (await modern.save({ photoUri: 'file:///cache/draft.jpg' }, null)).photoUri,
    photoUri,
  );
});

function repository(store) {
  const module = { exports: {} };
  const imports = new Map([
    ['expo', { requireOptionalNativeModule: () => store }],
    ['react-native', { Platform: { OS: 'android' } }],
    ['@/domain/patients/recordParser', parsers],
  ]);
  const requireStub = (specifier) => {
    assert.ok(imports.has(specifier), `意外的仓储依赖：${specifier}`);
    return imports.get(specifier);
  };
  new Function('require', 'module', 'exports', compiled)(requireStub, module, module.exports);
  return module.exports.patientRepository;
}

test('旧安装包仍可读写新增评估，修改和删除在调用原生前提示更新', async () => {
  let added;
  const legacy = repository({
    listAssessments: async () => JSON.stringify([current]),
    addAssessment: async (payload) => {
      added = JSON.parse(payload);
      return JSON.stringify(current);
    },
  });
  assert.equal(legacy.isAvailable, true);
  assert.equal(legacy.supportsAssessmentManagement, false);
  assert.deepEqual(await legacy.listAssessments(current.patientId), [current]);
  assert.deepEqual(await legacy.addAssessment(current.patientId, values), current);
  assert.deepEqual(added, { ...values, patientId: current.patientId });
  await assert.rejects(legacy.updateAssessment(current, values), {
    code: 'ASSESSMENT_UNAVAILABLE',
  });
  await assert.rejects(legacy.deleteAssessment(current), { code: 'ASSESSMENT_UNAVAILABLE' });
  const unavailable = repository(null);
  assert.equal(unavailable.isAvailable, false);
  assert.equal(unavailable.supportsAssessmentManagement, false);
  await assert.rejects(unavailable.deleteAssessment(current), { code: 'STORE_UNAVAILABLE' });
});

test('评估修改和删除传递完整原记录快照，保留零分和 null', async () => {
  const calls = [];
  const managed = repository({
    assessmentManagementVersion: () => 1,
    updateAssessment: async (payload) => {
      calls.push(JSON.parse(payload));
      return JSON.stringify({ ...current, ...values });
    },
    deleteAssessment: async (payload) => {
      calls.push(JSON.parse(payload));
      return current.id;
    },
  });
  assert.equal(managed.supportsAssessmentManagement, true);
  assert.deepEqual(await managed.updateAssessment(current, values), { ...current, ...values });
  await managed.deleteAssessment(current);
  assert.deepEqual(calls, [{ current, values }, current]);
  assert.equal(current.score, 0);
  assert.equal(current.notes, null);
});

test('原生冲突向上传递，错误的保存或删除回执不能作为成功', async () => {
  const managed = repository({
    assessmentManagementVersion: () => 1,
    updateAssessment: async () => {
      throw Object.assign(new Error('record changed'), { code: 'ASSESSMENT_CONFLICT' });
    },
    deleteAssessment: async () => 'another-assessment',
  });
  await assert.rejects(managed.updateAssessment(current, values), { code: 'ASSESSMENT_CONFLICT' });
  await assert.rejects(managed.deleteAssessment(current), /删除回执不正确/);
  const invalid = repository({
    assessmentManagementVersion: () => 1,
    updateAssessment: async () => JSON.stringify({ ...current, score: 57 }),
  });
  await assert.rejects(invalid.updateAssessment(current, values), /专业评估字段不正确/);
});
