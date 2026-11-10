import { mkdir, writeFile } from 'node:fs/promises';

import { loadTypeScript } from './loadTypeScript.mjs';
import { toCurrentRecording } from '../src/domain/observations/recordingFixtures.mjs';
import { sitToStandRecording } from '../src/domain/observations/sitToStandFixtures.mjs';
import { marchRecording } from '../src/domain/observations/marchInPlaceFixtures.mjs';
import { walkRecording } from '../src/domain/observations/shortWalkFixtures.mjs';

const { createObservationReport } = await loadTypeScript(
  'src/domain/observations/observationReport.ts',
);
const taskIds = [
  'elbow_flexion_extension',
  'shoulder_flexion',
  'seated_knee_extension',
  'seated_trunk_lean',
  'sit_to_stand',
  'march_in_place',
  'short_walk',
];
const currentReports = [];
for (const taskId of taskIds) {
  for (const side of ['left', 'right']) {
    const patient = { id: 'patient-1', patientCode: 'PA-01', affectedSide: side, revision: 1 };
    const session = {
      phase: 'finished',
      context: { patientId: patient.id, affectedSide: side, taskId },
    };
    const legacy =
      taskId === 'sit_to_stand'
        ? sitToStandRecording(undefined, { side })
        : taskId === 'march_in_place'
          ? marchRecording()
          : walkRecording();
    const pose = toCurrentRecording(legacy);
    const original = pose.segments[0];
    const split = Math.floor(original.durationMs / 200) * 100;
    const variants = [
      pose,
      { ...pose, isTruncated: true },
      {
        ...pose,
        segments: [
          {
            ...original,
            durationMs: split,
            frames: original.frames.filter((frame) => frame.timestampMs < split),
          },
          {
            ...original,
            segmentIndex: 1,
            startedAtMs: split + 5000,
            durationMs: original.durationMs - split,
            frames: original.frames
              .filter((frame) => frame.timestampMs >= split)
              .map((frame) => ({ ...frame, timestampMs: frame.timestampMs - split })),
          },
        ],
      },
    ];
    for (const recording of variants) {
      for (const [status, assisted] of [
        ['completed', false],
        ['completed', true],
        ['partial', true],
        ['unable', false],
      ]) {
        currentReports.push({
          pose: recording,
          report: createObservationReport(patient, session, recording, status, assisted),
        });
      }
    }
  }
}
const destination = process.argv[2] ?? '.local/data-contract-fixtures.json';
await mkdir('.local', { recursive: true });
await writeFile(destination, JSON.stringify({ currentReports }));
console.log(`已生成 ${currentReports.length} 份原生契约合成样本：${destination}`);
