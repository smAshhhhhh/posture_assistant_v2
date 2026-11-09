import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';
import { walkRecording } from '../../domain/observations/shortWalkFixtures.mjs';

const readerSource = await readFile(
  'modules/patient-store/android/src/main/java/com/postureassist/patients/ObservationReportReader.kt',
  'utf8',
);
const queries = Array.from(readerSource.matchAll(/"(SELECT [^"]+)"/g), (match) => match[1]);
const { createObservationReport } = await loadTypeScript(
  'src/domain/observations/observationReport.ts',
);
const { parseObservationReport } = await loadTypeScript(
  'src/domain/observations/observationParser.ts',
);

test('原生报告分片 SQL 可读取超过 2 MB 的真实长报告，保持中文和跨片 Unicode 完整', () => {
  const motion = Array.from({ length: 9000 }, (_, i) => ({
    left: i % 4 === 1 ? 50 : 180,
    right: i % 4 === 3 ? 50 : 180,
  }));
  const recording = walkRecording(motion, { width: 16384, height: 16384, speed: 140, scale: 0.1 });
  const report = createObservationReport(
    { id: 'p1', patientCode: 'PA-01', affectedSide: 'left', revision: 1 },
    {
      phase: 'finished',
      context: { patientId: 'p1', affectedSide: 'left', taskId: 'short_walk' },
      safetyStopReason: null,
    },
    recording,
    'partial',
    false,
  );
  const payload = JSON.stringify({ ...report, padding: '中文🙂'.repeat(35000) });
  assert.ok(Buffer.byteLength(payload) > 2_097_152);
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE observations (id TEXT PRIMARY KEY, report_json TEXT)');
    db.prepare('INSERT INTO observations VALUES (?, ?)').run(report.id, payload);
    assert.equal(queries.length, 2);
    const size = Object.values(db.prepare(queries[0]).get(report.id))[0];
    const chunks = db.prepare(queries[1]);
    let reconstructed = '';
    for (let offset = 1; offset <= size; offset += 65536) {
      const part = Object.values(chunks.get(String(offset), report.id))[0];
      assert.ok(Buffer.byteLength(part) <= 262144);
      reconstructed += part;
    }
    assert.equal(reconstructed, payload);
    assert.deepEqual(parseObservationReport(JSON.parse(reconstructed)), report);
    assert.equal(db.prepare(queries[0]).get('missing'), undefined);
  } finally {
    db.close();
  }
});
