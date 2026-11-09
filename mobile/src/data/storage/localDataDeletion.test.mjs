import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const directory = 'modules/patient-store/android/src/main/res/raw/';
const patientSql = await readFile(`${directory}patient_schema.sql`, 'utf8');
const observationSql = await readFile(`${directory}observation_schema.sql`, 'utf8');
const mediaSql = await readFile(`${directory}observation_media_schema.sql`, 'utf8');
const deleteSql = (await readFile(`${directory}local_data_delete.sql`, 'utf8'))
  .split(';')
  .map((sql) => sql.trim())
  .filter(Boolean);
const stamp = '2026-11-09T10:00:00.000Z';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys = ON; ${patientSql} ${observationSql} ${mediaSql}`);
  for (const [id, code] of [
    ['p1', 'PA-01'],
    ['p2', 'PA-02'],
  ]) {
    db.prepare(
      `INSERT INTO patients (id, patient_code, affected_side, consent_recorded_at, created_at, updated_at)
      VALUES (?, ?, 'left', ?, ?, ?)`,
    ).run(id, code, stamp, stamp, stamp);
    db.prepare(
      `INSERT INTO clinical_assessments (id, patient_id, scale, score, assessed_on, assessor, created_at)
      VALUES (?, ?, 'berg', 40, '2026-11-09', '治疗师', ?)`,
    ).run(`a-${id}`, id, stamp);
    for (const suffix of ['1', '2']) {
      const recordId = `${id}-${suffix}`;
      db.prepare(
        `INSERT INTO observations (id, patient_id, task_id, observed_at, affected_side,
        task_status, capture_quality, duration_ms, repetitions, report_json, pose_file,
        pose_bytes, pose_sha256, created_at) VALUES (?, ?, 'elbow_flexion_extension', ?, 'left',
        'completed', 'valid', 5000, 0, '{}', ?, 100, ?, ?)`,
      ).run(recordId, id, stamp, `observations/${recordId}.json`, 'a'.repeat(64), stamp);
      db.prepare('INSERT INTO observation_media VALUES (?, ?)').run(recordId, '{"segments":[]}');
    }
  }
  return db;
}

function execute(db, kind, id) {
  for (const sql of deleteSql) db.prepare(sql).run({ kind, id });
}

function counts(db) {
  return ['patients', 'clinical_assessments', 'observations'].map(
    (table) => db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count,
  );
}

test('单条删除保留所属患者、评估和其他观察', () => {
  const db = database();
  try {
    db.exec('BEGIN');
    execute(db, 'observation', 'p1-1');
    db.exec('COMMIT');
    assert.deepEqual(counts(db), [2, 2, 3]);
    assert.equal(db.prepare('SELECT count(*) AS count FROM observation_media').get().count, 3);
    assert.equal(
      db.prepare("SELECT count(*) AS count FROM observations WHERE patient_id = 'p2'").get().count,
      2,
    );
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('患者删除按依赖顺序移除全部关联，只保留其他患者资料', () => {
  const db = database();
  try {
    db.exec('BEGIN');
    execute(db, 'patient', 'p1');
    db.exec('COMMIT');
    assert.deepEqual(counts(db), [1, 1, 2]);
    assert.equal(db.prepare('SELECT count(*) AS count FROM observation_media').get().count, 2);
    assert.equal(db.prepare('SELECT id FROM patients').get().id, 'p2');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('全部删除无外键残留，失败回滚完整保留数据', () => {
  const db = database();
  try {
    db.exec('BEGIN');
    execute(db, 'all', null);
    assert.deepEqual(counts(db), [0, 0, 0]);
    assert.throws(() => db.exec('INSERT INTO missing_table VALUES (1)'));
    db.exec('ROLLBACK');
    assert.deepEqual(counts(db), [2, 2, 4]);
    assert.equal(db.prepare('SELECT count(*) AS count FROM observation_media').get().count, 4);
    db.exec('BEGIN');
    execute(db, 'all', null);
    db.exec('COMMIT');
    assert.deepEqual(counts(db), [0, 0, 0]);
    assert.equal(db.prepare('SELECT count(*) AS count FROM observation_media').get().count, 0);
  } finally {
    db.close();
  }
});

test('未知范围或不存在对象不扩大删除范围', () => {
  const db = database();
  try {
    execute(db, 'invalid', null);
    execute(db, 'patient', 'missing');
    execute(db, 'observation', 'missing');
    assert.deepEqual(counts(db), [2, 2, 4]);
  } finally {
    db.close();
  }
});
