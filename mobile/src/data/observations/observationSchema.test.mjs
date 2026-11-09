import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const patientSql = await readFile(
  'modules/patient-store/android/src/main/res/raw/patient_schema.sql',
  'utf8',
);
const observationSql = await readFile(
  'modules/patient-store/android/src/main/res/raw/observation_schema.sql',
  'utf8',
);
const prepareSql = await readFile(
  'modules/patient-store/android/src/main/res/raw/observation_upgrade_prepare.sql',
  'utf8',
);
const copySql = await readFile(
  'modules/patient-store/android/src/main/res/raw/observation_upgrade_copy.sql',
  'utf8',
);
const stamp = '2026-11-09T10:00:00.000Z';
const mediaSql = await readFile(
  'modules/patient-store/android/src/main/res/raw/observation_media_schema.sql',
  'utf8',
);
const mediaPrepareSql = await readFile(
  'modules/patient-store/android/src/main/res/raw/observation_media_upgrade_prepare.sql',
  'utf8',
);
const copyWithMediaSql = await readFile(
  'modules/patient-store/android/src/main/res/raw/observation_upgrade_copy_with_media.sql',
  'utf8',
);

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(patientSql);
  db.prepare(
    `INSERT INTO patients (id, patient_code, affected_side, consent_recorded_at, created_at, updated_at)
    VALUES ('patient-1', 'PA-01', 'left', ?, ?, ?)`,
  ).run(stamp, stamp, stamp);
  db.exec('PRAGMA user_version = 1');
  return db;
}

test('观察表在事务内从 v1 直接迁移至 v8，患者档案及 revision 保留', () => {
  const db = database();
  try {
    db.exec(`BEGIN; ${observationSql} ${mediaSql} PRAGMA user_version = 8; COMMIT;`);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 8);
    const patient = db.prepare('SELECT * FROM patients').get();
    assert.equal(patient.patient_code, 'PA-01');
    assert.equal(patient.revision, 1);
    assert.equal(db.prepare('SELECT count(*) AS count FROM observations').get().count, 0);
  } finally {
    db.close();
  }
});

test('保存的报告和关键点索引关闭重开后保留，患者最近观察取实际时间', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'posture-observations-'));
  const filename = path.join(directory, 'records.db');
  let db = new DatabaseSync(filename);
  try {
    db.exec(`PRAGMA foreign_keys = ON; ${patientSql} ${observationSql} ${mediaSql}
      PRAGMA user_version = 8;`);
    db.prepare(
      `INSERT INTO patients (id, patient_code, affected_side, consent_recorded_at,
      created_at, updated_at) VALUES ('patient-1', 'PA-01', 'left', ?, ?, ?)`,
    ).run(stamp, stamp, stamp);
    const payload = JSON.stringify({ patientId: 'patient-1', taskStatus: 'completed' });
    db.prepare(
      `INSERT INTO observations (id, patient_id, task_id, observed_at, affected_side,
      task_status, capture_quality, duration_ms, repetitions, report_json, pose_file,
      pose_bytes, pose_sha256, created_at) VALUES ('record-1', 'patient-1',
      'elbow_flexion_extension', ?, 'left', 'completed', 'valid', 4000, 0, ?,
      'observations/record-1.json', 100, ?, ?)`,
    ).run(stamp, payload, 'a'.repeat(64), stamp);
    db.close();
    db = new DatabaseSync(filename);
    const saved = db.prepare('SELECT * FROM observations').get();
    assert.equal(saved.report_json, payload);
    assert.equal(saved.repetitions, 0);
    assert.equal(saved.pose_file, 'observations/record-1.json');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 8);
    assert.equal(
      db
        .prepare(
          `SELECT (SELECT MAX(observed_at) FROM observations
      WHERE observations.patient_id = patients.id) AS last_observed_at FROM patients`,
        )
        .get().last_observed_at,
      stamp,
    );
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

function legacyDatabase(version = 2) {
  const db = database();
  const legacySql = observationSql.replace(
    /task_id IN \([\s\S]*?\)/,
    version === 2
      ? "task_id = 'elbow_flexion_extension'"
      : version === 3
        ? "task_id IN ('elbow_flexion_extension', 'shoulder_flexion', 'seated_knee_extension')"
        : version < 6
          ? "task_id IN ('elbow_flexion_extension', 'shoulder_flexion', 'seated_knee_extension', 'seated_trunk_lean')"
          : version === 6
            ? "task_id IN ('elbow_flexion_extension', 'shoulder_flexion', 'seated_knee_extension', 'seated_trunk_lean', 'sit_to_stand')"
            : "task_id IN ('elbow_flexion_extension', 'shoulder_flexion', 'seated_knee_extension', 'seated_trunk_lean', 'sit_to_stand', 'march_in_place')",
  );
  assert.notEqual(legacySql, observationSql);
  db.exec(`${legacySql} PRAGMA user_version = ${version};`);
  if (version >= 5) db.exec(mediaSql);
  db.prepare(
    `INSERT INTO clinical_assessments (id, patient_id, scale, score, assessed_on, assessor, created_at)
    VALUES ('assessment-1', 'patient-1', 'berg', 40, '2026-11-09', '治疗师', ?)`,
  ).run(stamp);
  return db;
}

function insertObservation(db, id, taskId) {
  db.prepare(
    `INSERT INTO observations (id, patient_id, task_id, observed_at, affected_side,
    task_status, capture_quality, duration_ms, repetitions, report_json, pose_file,
    pose_bytes, pose_sha256, created_at) VALUES (?, 'patient-1', ?, ?, 'left',
    'completed', 'valid', 5000, 1, ?, ?, 100, ?, ?)`,
  ).run(
    id,
    taskId,
    stamp,
    JSON.stringify({ id, taskId }),
    `observations/${id}.json`,
    'a'.repeat(64),
    stamp,
  );
}

test('v2 升级至 v8 保留患者、评估、报告和文件索引，允许肩膝躯干、坐站与踏步', () => {
  const db = legacyDatabase();
  try {
    insertObservation(db, 'elbow-1', 'elbow_flexion_extension');
    const oldReport = db.prepare('SELECT * FROM observations').get();
    assert.throws(() => insertObservation(db, 'shoulder-1', 'shoulder_flexion'));
    db.exec(`BEGIN; ${prepareSql} ${observationSql} ${copySql} ${mediaSql}
      PRAGMA user_version = 8; COMMIT;`);
    assert.deepEqual(db.prepare('SELECT * FROM observations').get(), oldReport);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 8);
    assert.equal(db.prepare('SELECT revision FROM patients').get().revision, 1);
    assert.equal(db.prepare('SELECT score FROM clinical_assessments').get().score, 40);
    insertObservation(db, 'shoulder-1', 'shoulder_flexion');
    insertObservation(db, 'knee-1', 'seated_knee_extension');
    insertObservation(db, 'trunk-1', 'seated_trunk_lean');
    insertObservation(db, 'sit-stand-1', 'sit_to_stand');
    insertObservation(db, 'march-1', 'march_in_place');
    assert.equal(db.prepare('SELECT count(*) AS count FROM observations').get().count, 6);
    insertObservation(db, 'walk-1', 'short_walk');
    assert.throws(() => insertObservation(db, 'unsupported', 'unsupported_task'));
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(
      db
        .prepare("SELECT count(*) AS count FROM sqlite_master WHERE name = 'observations_previous'")
        .get().count,
      0,
    );
  } finally {
    db.close();
  }
});

test('v2 升级失败回滚，旧报告、原表约束和版本保持完整', () => {
  const db = legacyDatabase();
  try {
    insertObservation(db, 'elbow-1', 'elbow_flexion_extension');
    const original = db.prepare('SELECT * FROM observations').get();
    db.exec('BEGIN');
    assert.throws(() =>
      db.exec(`${prepareSql} ${observationSql} ${copySql}
      CREATE TABLE patients (id TEXT);`),
    );
    db.exec('ROLLBACK');
    assert.deepEqual(db.prepare('SELECT * FROM observations').get(), original);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
    assert.throws(() => insertObservation(db, 'knee-1', 'seated_knee_extension'));
    assert.equal(
      db
        .prepare(
          "SELECT count(*) AS count FROM sqlite_master WHERE name = 'observations_patient_date'",
        )
        .get().count,
      1,
    );
  } finally {
    db.close();
  }
});

test('v3 升级和失败回滚均保留三种旧任务、评估及原始文件索引', () => {
  const db = legacyDatabase(3);
  try {
    for (const task of ['elbow_flexion_extension', 'shoulder_flexion', 'seated_knee_extension']) {
      insertObservation(db, task, task);
    }
    const originals = db.prepare('SELECT * FROM observations ORDER BY id').all();
    const assessment = db.prepare('SELECT * FROM clinical_assessments').get();
    const patient = db.prepare('SELECT * FROM patients').get();
    assert.throws(() => insertObservation(db, 'trunk', 'seated_trunk_lean'));
    db.exec('BEGIN');
    assert.throws(() =>
      db.exec(`${prepareSql} ${observationSql} ${copySql} CREATE TABLE patients (id TEXT);`),
    );
    db.exec('ROLLBACK');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
    assert.deepEqual(db.prepare('SELECT * FROM observations ORDER BY id').all(), originals);
    assert.throws(() => insertObservation(db, 'trunk', 'seated_trunk_lean'));
    db.exec(`BEGIN; ${prepareSql} ${observationSql} ${copySql} ${mediaSql}
      PRAGMA user_version = 8; COMMIT;`);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 8);
    assert.deepEqual(db.prepare('SELECT * FROM observations ORDER BY id').all(), originals);
    assert.deepEqual(db.prepare('SELECT * FROM clinical_assessments').get(), assessment);
    assert.deepEqual(db.prepare('SELECT * FROM patients').get(), patient);
    insertObservation(db, 'trunk', 'seated_trunk_lean');
    insertObservation(db, 'sit-stand', 'sit_to_stand');
    insertObservation(db, 'march_in_place', 'march_in_place');
    insertObservation(db, 'short_walk', 'short_walk');
    assert.throws(() => insertObservation(db, 'unsupported', 'unsupported_task'));
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(
      db
        .prepare("SELECT count(*) AS count FROM sqlite_master WHERE name = 'observations_previous'")
        .get().count,
      0,
    );
  } finally {
    db.close();
  }
});

test('迁移失败整体回滚，观察索引约束患者归属、状态、质量和文件元数据', () => {
  const db = database();
  try {
    db.exec('BEGIN');
    assert.throws(() => db.exec(`${observationSql} CREATE TABLE patients (id TEXT);`));
    db.exec('ROLLBACK');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal(
      db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name = 'observations'").get()
        .count,
      0,
    );
    db.exec(observationSql);
    const insert = db.prepare(`INSERT INTO observations (id, patient_id, task_id, observed_at,
      affected_side, task_status, capture_quality, duration_ms, report_json, pose_file,
      pose_bytes, pose_sha256, created_at) VALUES (?, ?, 'elbow_flexion_extension', ?,
      'left', ?, ?, ?, '{}', ?, 100, ?, ?)`);
    const add = (id, patient, status, quality, duration) =>
      insert.run(
        id,
        patient,
        stamp,
        status,
        quality,
        duration,
        `${id}.json`,
        'a'.repeat(64),
        stamp,
      );
    add('record-1', 'patient-1', 'completed', 'invalid_capture', 0);
    assert.throws(() => add('record-2', 'missing', 'completed', 'valid', 1_000));
    assert.throws(() => add('record-2', 'patient-1', 'unknown', 'valid', 1_000));
    assert.throws(() => add('record-2', 'patient-1', 'completed', 'unknown', 1_000));
    assert.throws(() => add('record-2', 'patient-1', 'completed', 'valid', -1));
    assert.throws(() => add('record-1', 'patient-1', 'completed', 'valid', 1_000));
    assert.equal(
      db.prepare('SELECT task_status, capture_quality FROM observations').get().capture_quality,
      'invalid_capture',
    );
    assert.throws(() => db.prepare("DELETE FROM patients WHERE id = 'patient-1'").run());
  } finally {
    db.close();
  }
});

for (const version of [1, 2, 3, 4, 5, 6, 7]) {
  test(`v${version} 升级 v8 保留既有数据和视频，失败整体回滚并允许步行保存`, () => {
    const db = version === 1 ? database() : legacyDatabase(version);
    try {
      if (version > 1) insertObservation(db, 'old', 'elbow_flexion_extension');
      if (version >= 3) {
        insertObservation(db, 'shoulder', 'shoulder_flexion');
        insertObservation(db, 'knee', 'seated_knee_extension');
      }
      if (version >= 4) insertObservation(db, 'trunk', 'seated_trunk_lean');
      if (version >= 6) insertObservation(db, 'sit-stand', 'sit_to_stand');
      if (version >= 7) insertObservation(db, 'march', 'march_in_place');
      if (version >= 5)
        db.prepare('INSERT INTO observation_media VALUES (?, ?)').run(
          'old',
          '{"segments":[{"path":"old-0.mp4","sha256":"retained"}]}',
        );
      if (version >= 6)
        db.prepare('INSERT INTO observation_media VALUES (?, ?)').run(
          'sit-stand',
          '{"segments":[{"path":"sit-stand-0.mp4","sha256":"retained"}]}',
        );
      if (version >= 7)
        db.prepare('INSERT INTO observation_media VALUES (?, ?)').run(
          'march',
          '{"segments":[{"path":"march-0.mp4","sha256":"retained"}]}',
        );
      const oldPatients = db.prepare('SELECT * FROM patients').all();
      const oldAssessments = db.prepare('SELECT * FROM clinical_assessments').all();
      const oldObservations = version === 1 ? [] : db.prepare('SELECT * FROM observations').all();
      const oldMedia = version >= 5 ? db.prepare('SELECT * FROM observation_media').all() : [];
      if (version > 1) assert.throws(() => insertObservation(db, 'walk', 'short_walk'));
      const upgrade =
        version === 1
          ? `${observationSql} ${mediaSql}`
          : version >= 5
            ? `${mediaPrepareSql} ${prepareSql} ${observationSql} ${mediaSql} ${copyWithMediaSql}`
            : `${prepareSql} ${observationSql} ${copySql} ${mediaSql}`;
      db.exec('BEGIN');
      assert.throws(() => db.exec(`${upgrade} CREATE TABLE patients(id);`));
      db.exec('ROLLBACK');
      assert.equal(db.prepare('PRAGMA user_version').get().user_version, version);
      if (version > 1) {
        assert.deepEqual(db.prepare('SELECT * FROM observations').all(), oldObservations);
        assert.throws(() => insertObservation(db, 'walk', 'short_walk'));
      }
      if (version >= 5)
        assert.deepEqual(db.prepare('SELECT * FROM observation_media').all(), oldMedia);
      db.exec(`BEGIN; ${upgrade} PRAGMA user_version = 8; COMMIT;`);
      assert.equal(db.prepare('PRAGMA user_version').get().user_version, 8);
      assert.deepEqual(db.prepare('SELECT * FROM patients').all(), oldPatients);
      assert.deepEqual(db.prepare('SELECT * FROM clinical_assessments').all(), oldAssessments);
      assert.deepEqual(db.prepare('SELECT * FROM observations').all(), oldObservations);
      assert.deepEqual(db.prepare('SELECT * FROM observation_media').all(), oldMedia);
      insertObservation(db, 'new', 'short_walk');
      assert.throws(() => insertObservation(db, 'unsupported', 'unsupported_task'));
      const insert = db.prepare('INSERT INTO observation_media VALUES (?, ?)');
      assert.throws(() => insert.run('missing', '{}'));
      db.exec('BEGIN');
      insert.run('new', '{"segments":[]}');
      db.exec('ROLLBACK');
      assert.deepEqual(db.prepare('SELECT * FROM observation_media').all(), oldMedia);
      insert.run('new', '{"segments":[]}');
      db.prepare('DELETE FROM observations WHERE id = ?').run('new');
      assert.deepEqual(db.prepare('SELECT * FROM observation_media').all(), oldMedia);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
      assert.equal(
        db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name LIKE '%_previous'").get()
          .count,
        0,
      );
    } finally {
      db.close();
    }
  });
}
