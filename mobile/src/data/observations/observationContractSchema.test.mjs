import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

test('v10 保留旧安全记录和视频，限制新写入为四状态，失败可整体回滚', async () => {
  const sql = await readFile(
    'modules/patient-store/android/src/main/res/raw/observation_contract_upgrade.sql',
    'utf8',
  );
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE observations(id TEXT PRIMARY KEY, task_status TEXT, report_json TEXT);
      CREATE TABLE observation_media(observation_id TEXT, manifest_json TEXT);
      INSERT INTO observations VALUES('old', 'stopped_safety', '{"schemaVersion":1}');
      INSERT INTO observation_media VALUES('old', '{"segments":[1]}');
      PRAGMA user_version=9;`);
    db.exec('BEGIN');
    db.exec(sql);
    db.exec('ROLLBACK');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 9);
    // 复用原生的触发器拆分方式，确认 BEGIN/END 不被分号拆坏。
    db.exec('BEGIN');
    for (const statement of sql
      .split('END;')
      .map((part) => part.trim())
      .filter(Boolean)) {
      db.exec(`${statement} END;`);
    }
    db.exec('PRAGMA user_version=10; COMMIT;');
    assert.equal(
      db.prepare('SELECT task_status FROM observations').get().task_status,
      'stopped_safety',
    );
    assert.equal(
      db.prepare('SELECT manifest_json FROM observation_media').get().manifest_json,
      '{"segments":[1]}',
    );
    for (const status of ['completed', 'partial', 'assisted', 'unable']) {
      db.prepare('INSERT INTO observations VALUES(?, ?, ?)').run(status, status, '{}');
    }
    for (const status of ['not_attempted', 'not_applicable', 'stopped_safety']) {
      assert.throws(() =>
        db.prepare('INSERT INTO observations VALUES(?, ?, ?)').run('new', status, '{}'),
      );
      assert.throws(() =>
        db.prepare('UPDATE observations SET task_status=? WHERE id=?').run(status, 'partial'),
      );
    }
  } finally {
    db.close();
  }
});
