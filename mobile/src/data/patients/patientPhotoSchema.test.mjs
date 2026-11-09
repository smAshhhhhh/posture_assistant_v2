import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const directory = 'modules/patient-store/android/src/main/res/raw/';
const patientSql = await readFile(`${directory}patient_schema.sql`, 'utf8');
const migration = await readFile(`${directory}patient_photo_upgrade.sql`, 'utf8');
const observationSql = await readFile(`${directory}observation_schema.sql`, 'utf8');
const mediaSql = await readFile(`${directory}observation_media_schema.sql`, 'utf8');

test('v8 升级只增加可空头像列，保留患者、评估和视频记录', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const legacy = patientSql.replace(/^  photo_file .*\r?\n/m, '');
    assert.notEqual(legacy, patientSql);
    db.exec(`PRAGMA foreign_keys = ON; ${legacy} ${observationSql} ${mediaSql}`);
    const timestamp = '2026-11-09T10:00:00.000Z';
    db.prepare(
      `INSERT INTO patients (id, patient_code, affected_side,
      consent_recorded_at, created_at, updated_at) VALUES ('p1', 'PA-01', 'left', ?, ?, ?)`,
    ).run(timestamp, timestamp, timestamp);
    db.prepare(
      `INSERT INTO clinical_assessments (id, patient_id, scale, score,
      assessed_on, assessor, created_at) VALUES ('a1', 'p1', 'berg', 40, '2026-11-09', 'T-01', ?)`,
    ).run(timestamp);
    db.prepare(
      `INSERT INTO observations (id, patient_id, task_id, observed_at,
      affected_side, task_status, capture_quality, duration_ms, repetitions,
      report_json, pose_file, pose_bytes, pose_sha256, created_at)
      VALUES ('o1', 'p1', 'elbow_flexion_extension', ?, 'left', 'completed', 'valid',
      1000, 0, '{}', 'observations/o1.json', 2, ?, ?)`,
    ).run(timestamp, 'a'.repeat(64), timestamp);
    db.exec(`INSERT INTO observation_media VALUES ('o1', '{"segments":[]}');
      PRAGMA user_version = 8; BEGIN; ${migration} PRAGMA user_version = 9; COMMIT;`);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 9);
    assert.equal(db.prepare('SELECT photo_file FROM patients').get().photo_file, null);
    assert.equal(db.prepare('SELECT score FROM clinical_assessments').get().score, 40);
    assert.equal(
      db.prepare('SELECT manifest_json FROM observation_media').get().manifest_json,
      '{"segments":[]}',
    );
    const file = '12345678-1234-4234-8234-123456789abc.jpg';
    db.prepare('UPDATE patients SET photo_file = ? WHERE id = ?').run(file, 'p1');
    assert.equal(db.prepare('SELECT photo_file FROM patients').get().photo_file, file);
    assert.throws(() => db.exec("UPDATE patients SET photo_file = '../escape'"));
    db.exec('UPDATE patients SET photo_file = NULL');
    assert.equal(db.prepare('SELECT patient_code FROM patients').get().patient_code, 'PA-01');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});
