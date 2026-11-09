import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const schema = await readFile(
  'modules/patient-store/android/src/main/res/raw/patient_schema.sql',
  'utf8',
);
const timestamp = '2026-11-09T10:00:00.000Z';

function createDatabase(file = ':memory:') {
  const database = new DatabaseSync(file);
  database.exec('PRAGMA foreign_keys = ON');
  return database;
}

function insertPatient(database, id, code) {
  database
    .prepare(
      `INSERT INTO patients (
    id, patient_code, affected_side, consent_recorded_at, created_at, updated_at
  ) VALUES (?, ?, 'left', ?, ?, ?)`,
    )
    .run(id, code, timestamp, timestamp, timestamp);
}

test('患者数据库创建后为空，关闭重开保留资料和版本', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'posture-patients-'));
  const filename = path.join(directory, 'patients.db');
  let database = createDatabase(filename);
  try {
    database.exec(`BEGIN; ${schema} PRAGMA user_version = 1; COMMIT;`);
    assert.equal(database.prepare('SELECT count(*) AS count FROM patients').get().count, 0);
    insertPatient(database, 'patient-1', 'PA-01');
    database.close();
    database = createDatabase(filename);
    assert.equal(database.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal(database.prepare('SELECT patient_code FROM patients').get().patient_code, 'PA-01');
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('SQLite 拒绝重复编号、非法患侧和缺少来源的能力等级', () => {
  const database = createDatabase();
  try {
    database.exec(schema);
    insertPatient(database, 'patient-1', 'PA-01');
    assert.throws(() => insertPatient(database, 'patient-2', 'pa-01'));
    assert.throws(() => database.prepare("UPDATE patients SET affected_side = 'both'").run());
    assert.throws(() => database.prepare("UPDATE patients SET ability_level = 'mild'").run());
    assert.throws(() => database.prepare('UPDATE patients SET age_years = 121').run());
    assert.throws(() => database.prepare('UPDATE patients SET age_years = 0.5').run());
    database.prepare('UPDATE patients SET age_years = 0').run();
    assert.equal(database.prepare('SELECT age_years FROM patients').get().age_years, 0);
  } finally {
    database.close();
  }
});

test('保存失败可整体回滚，陈旧 revision 不能覆盖新档案', () => {
  const database = createDatabase();
  try {
    database.exec(schema);
    database.exec('BEGIN');
    insertPatient(database, 'rolled-back', 'PA-01');
    assert.throws(() => insertPatient(database, 'duplicate', 'PA-01'));
    database.exec('ROLLBACK');
    assert.equal(database.prepare('SELECT count(*) AS count FROM patients').get().count, 0);
    insertPatient(database, 'patient-1', 'PA-01');
    const update = database.prepare(
      'UPDATE patients SET revision = revision + 1 WHERE id = ? AND revision = ?',
    );
    assert.equal(update.run('patient-1', 1).changes, 1);
    assert.equal(update.run('patient-1', 1).changes, 0);
  } finally {
    database.close();
  }
});

test('评估记录归属患者，分数按量表约束且不改变能力等级', () => {
  const database = createDatabase();
  try {
    database.exec(schema);
    insertPatient(database, 'patient-1', 'PA-01');
    const insert = database.prepare(`INSERT INTO clinical_assessments (
      id, patient_id, scale, score, assessed_on, assessor, created_at
    ) VALUES (?, ?, ?, ?, '2026-11-09', 'T-03', ?)`);
    insert.run('assessment-1', 'patient-1', 'fma_upper', 0, timestamp);
    assert.throws(() => insert.run('assessment-2', 'missing', 'fma_upper', 30, timestamp));
    assert.throws(() => insert.run('assessment-3', 'patient-1', 'fma_upper', 67, timestamp));
    assert.throws(() => insert.run('assessment-4', 'patient-1', 'berg', 1.5, timestamp));
    assert.equal(database.prepare('SELECT score FROM clinical_assessments').get().score, 0);
    assert.equal(database.prepare('SELECT ability_level FROM patients').get().ability_level, null);
    assert.throws(() => database.prepare("DELETE FROM patients WHERE id = 'patient-1'").run());
  } finally {
    database.close();
  }
});

test('评估更正保留归属和录入时间，失败回滚，单条删除保留其他资料', () => {
  const database = createDatabase();
  try {
    database.exec(schema);
    insertPatient(database, 'patient-1', 'PA-01');
    insertPatient(database, 'patient-2', 'PA-02');
    const insert = database.prepare(`INSERT INTO clinical_assessments (
      id, patient_id, scale, score, assessed_on, assessor, notes, created_at
    ) VALUES (?, ?, 'berg', 0, '2026-11-09', 'T-03', NULL, ?)`);
    insert.run('assessment-1', 'patient-1', timestamp);
    insert.run('assessment-2', 'patient-1', timestamp);
    insert.run('assessment-3', 'patient-2', timestamp);
    const original = database
      .prepare('SELECT * FROM clinical_assessments WHERE id = ?')
      .get('assessment-1');
    const update = database.prepare(`UPDATE clinical_assessments
      SET scale = ?, score = ?, assessed_on = ?, assessor = ?, notes = ?
      WHERE id = ? AND patient_id = ?`);
    database.exec('BEGIN');
    assert.equal(
      update.run('barthel', 100, '2026-11-08', 'T-04', '更正录入', 'assessment-1', 'patient-2')
        .changes,
      0,
    );
    assert.equal(
      update.run('barthel', 100, '2026-11-08', 'T-04', '更正录入', 'assessment-1', 'patient-1')
        .changes,
      1,
    );
    assert.throws(() =>
      update.run('berg', 57, '2026-11-08', 'T-04', null, 'assessment-1', 'patient-1'),
    );
    database.exec('ROLLBACK');
    assert.deepEqual(
      database.prepare('SELECT * FROM clinical_assessments WHERE id = ?').get('assessment-1'),
      original,
    );
    update.run('barthel', 100, '2026-11-08', 'T-04', '更正录入', 'assessment-1', 'patient-1');
    const saved = database
      .prepare('SELECT * FROM clinical_assessments WHERE id = ?')
      .get('assessment-1');
    assert.equal(saved.patient_id, original.patient_id);
    assert.equal(saved.created_at, timestamp);
    assert.equal(saved.score, 100);
    assert.equal(saved.notes, '更正录入');
    const remove = database.prepare(
      'DELETE FROM clinical_assessments WHERE id = ? AND patient_id = ?',
    );
    assert.equal(remove.run('assessment-1', 'patient-2').changes, 0);
    assert.equal(remove.run('assessment-1', 'patient-1').changes, 1);
    assert.deepEqual(
      database
        .prepare('SELECT id FROM clinical_assessments ORDER BY id')
        .all()
        .map((row) => row.id),
      ['assessment-2', 'assessment-3'],
    );
    assert.equal(database.prepare('SELECT count(*) AS count FROM patients').get().count, 2);
    assert.equal(database.prepare('SELECT ability_level FROM patients').get().ability_level, null);
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});
