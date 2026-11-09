import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const { createPatientDraft, validatePatientDraft, isValidPastDate } = await loadTypeScript(
  'src/domain/patients/patientRecord.ts',
);
const { assessmentScales, createAssessmentDraft, validateAssessmentDraft } = await loadTypeScript(
  'src/domain/patients/clinicalAssessment.ts',
);
const { parsePatientProfile, parseClinicalAssessment } = await loadTypeScript(
  'src/domain/patients/recordParser.ts',
);
const today = '2026-11-09';
const valid = {
  ...createPatientDraft(),
  patientCode: ' pa-0001 ',
  affectedSide: 'left',
  hasConsent: true,
};

test('患者保存需要编号、患侧和授权，未知资料保留 null', () => {
  const missing = validatePatientDraft(createPatientDraft(), today);
  assert.equal(missing.isValid, false);
  for (const field of ['patientCode', 'affectedSide', 'hasConsent'])
    assert.ok(missing.errors[field]);
  const result = validatePatientDraft(valid, today);
  assert.equal(result.isValid, true);
  assert.equal(result.value.patientCode, 'PA-0001');
  for (const field of [
    'ageYears',
    'onsetDate',
    'abilityLevel',
    'abilityAssessor',
    'abilityAssessedOn',
  ]) {
    assert.equal(result.value[field], null);
  }
});

test('患者编号标准化且拒绝姓名、SQL 字符与超长内容', () => {
  assert.equal(
    validatePatientDraft({ ...valid, patientCode: 'ＰＡ－０００１' }, today).value.patientCode,
    'PA-0001',
  );
  for (const patientCode of ['', '张三', "PA'; DROP TABLE patients;", 'A', 'P'.repeat(33)]) {
    assert.equal(validatePatientDraft({ ...valid, patientCode }, today).isValid, false);
  }
});

test('患者照片选填，保留本地地址并拒绝远程地址', () => {
  assert.equal(createPatientDraft().photoUri, null);
  const uri = 'file:///data/user/0/com.postureassist.mobile/cache/patient-photo-drafts/photo.jpg';
  const saved = validatePatientDraft({ ...valid, photoUri: uri }, today);
  assert.equal(saved.value.photoUri, uri);
  assert.equal(createPatientDraft({ ...saved.value }).photoUri, uri);
  for (const photoUri of ['', 'https://example.com/photo.jpg', 'content://photos/1']) {
    const result = validatePatientDraft({ ...valid, photoUri }, today);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.photoUri);
  }
});

test('年龄必须是有效整数，零岁与未知年龄区分保存', () => {
  assert.equal(validatePatientDraft({ ...valid, ageYears: '0' }, today).value.ageYears, 0);
  assert.equal(validatePatientDraft({ ...valid, ageYears: '120' }, today).value.ageYears, 120);
  for (const ageYears of ['-1', '121', '2.5', 'abc', '1e2']) {
    assert.equal(validatePatientDraft({ ...valid, ageYears }, today).isValid, false);
  }
});

test('日期检查真实日历和未来时间，不把非法日期自动滚动', () => {
  for (const value of ['2026-02-29', '2024-02-30', '2026-11-10', '2026-1-01', '1899-12-31']) {
    assert.equal(isValidPastDate(value, today), false);
  }
  assert.equal(isValidPastDate('2024-02-29', today), true);
  assert.equal(isValidPastDate(today, today), true);
  assert.equal(validatePatientDraft({ ...valid, onsetDate: '2026-02-30' }, today).isValid, false);
});

test('能力等级必须有专业评定来源，清空等级同时清空来源', () => {
  assert.equal(validatePatientDraft({ ...valid, abilityLevel: 'mild' }, today).isValid, false);
  const assessed = validatePatientDraft(
    { ...valid, abilityLevel: 'moderate', abilityAssessor: ' T-03 ', abilityAssessedOn: today },
    today,
  );
  assert.equal(assessed.isValid, true);
  assert.equal(assessed.value.abilityAssessor, 'T-03');
  const cleared = validatePatientDraft(
    { ...valid, abilityAssessor: 'T-03', abilityAssessedOn: today },
    today,
  );
  assert.equal(cleared.value.abilityLevel, null);
  assert.equal(cleared.value.abilityAssessor, null);
  assert.equal(cleared.value.abilityAssessedOn, null);
});

test('各量表按所选版本校验总分，合法零分不转为缺失', () => {
  for (const scale of assessmentScales) {
    const draft = { scale: scale.id, score: '0', assessor: 'T-03', assessedOn: today, notes: '' };
    assert.equal(validateAssessmentDraft(draft, today).value.score, 0);
    assert.equal(
      validateAssessmentDraft({ ...draft, score: String(scale.maxScore) }, today).isValid,
      true,
    );
    for (const score of ['', '-1', '0.5', String(scale.maxScore + 1), 'NaN']) {
      assert.equal(validateAssessmentDraft({ ...draft, score }, today).isValid, false);
    }
    assert.equal(validateAssessmentDraft({ ...draft, assessor: '' }, today).isValid, false);
    assert.equal(
      validateAssessmentDraft({ ...draft, notes: '文'.repeat(501) }, today).isValid,
      false,
    );
  }
});

test('修改评估还原原记录和零分，表单改动不污染已保存值', () => {
  const current = {
    id: 'assessment-id',
    patientId: 'patient-id',
    scale: 'berg',
    score: 0,
    assessedOn: today,
    assessor: 'T-03',
    notes: null,
    createdAt: '2026-11-09T10:00:00.000Z',
  };
  const draft = createAssessmentDraft(current);
  assert.deepEqual(draft, {
    scale: 'berg',
    score: '0',
    assessedOn: today,
    assessor: 'T-03',
    notes: '',
  });
  const changed = { ...draft, score: '56', notes: '复核后更正' };
  const validation = validateAssessmentDraft(changed, today);
  assert.equal(validation.isValid, true);
  assert.equal(validation.value.score, 56);
  assert.equal(validation.value.notes, '复核后更正');
  assert.equal(current.score, 0);
  assert.equal(current.notes, null);
  assert.equal(createAssessmentDraft(null).score, '');
});

test('存储边界拒绝破损患者或评估，保留合法的 null 与零值', () => {
  const patient = {
    id: 'patient-id',
    patientCode: 'PA-01',
    ageYears: 0,
    affectedSide: 'left',
    abilityLevel: null,
    abilityAssessor: null,
    abilityAssessedOn: null,
    onsetDate: null,
    lastObservedAt: null,
    consentRecordedAt: '2026-11-09T10:00:00.000Z',
    createdAt: '2026-11-09T10:00:00.000Z',
    updatedAt: '2026-11-09T10:00:00.000Z',
    revision: 1,
  };
  assert.equal(parsePatientProfile(patient).ageYears, 0);
  assert.equal(parsePatientProfile(patient).photoUri, null);
  const photoUri = 'file:///data/user/0/app/files/patient-photos/photo.jpg';
  assert.equal(parsePatientProfile({ ...patient, photoUri }).photoUri, photoUri);
  assert.throws(() => parsePatientProfile({ ...patient, photoUri: 'https://example.com/p.jpg' }));
  for (const invalid of [
    null,
    {},
    { ...patient, affectedSide: 'both' },
    { ...patient, ageYears: -1 },
    { ...patient, revision: 0 },
    { ...patient, abilityLevel: 'mild' },
  ]) {
    assert.throws(() => parsePatientProfile(invalid));
  }
  const record = {
    id: 'assessment-id',
    patientId: 'patient-id',
    scale: 'fma_upper',
    score: 0,
    assessedOn: today,
    assessor: 'T-03',
    notes: null,
    createdAt: patient.createdAt,
  };
  assert.equal(parseClinicalAssessment(record).score, 0);
  assert.throws(() => parseClinicalAssessment({ ...record, score: 67 }));
  assert.throws(() => parseClinicalAssessment({ ...record, scale: 'unknown' }));
});
