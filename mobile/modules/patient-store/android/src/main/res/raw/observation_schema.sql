CREATE TABLE observations (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  task_id TEXT NOT NULL CHECK (
    task_id IN (
      'elbow_flexion_extension', 'shoulder_flexion',
      'seated_knee_extension', 'seated_trunk_lean', 'sit_to_stand', 'march_in_place', 'short_walk'
    )
  ),
  observed_at TEXT NOT NULL,
  affected_side TEXT NOT NULL CHECK (affected_side IN ('left', 'right')),
  task_status TEXT NOT NULL CHECK (
    task_status IN ('completed', 'partial', 'assisted', 'unable', 'stopped_safety')
  ),
  capture_quality TEXT NOT NULL CHECK (capture_quality IN ('valid', 'degraded', 'invalid_capture')),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  repetitions INTEGER CHECK (
    repetitions IS NULL OR (repetitions >= 0 AND capture_quality <> 'invalid_capture')
  ),
  report_json TEXT NOT NULL,
  pose_file TEXT NOT NULL UNIQUE,
  pose_bytes INTEGER NOT NULL CHECK (pose_bytes > 0),
  pose_sha256 TEXT NOT NULL CHECK (length(pose_sha256) = 64),
  created_at TEXT NOT NULL
);

CREATE INDEX observations_patient_date ON observations(patient_id, observed_at DESC, id);
