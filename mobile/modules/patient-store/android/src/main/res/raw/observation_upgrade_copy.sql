INSERT INTO observations (
  id, patient_id, task_id, observed_at, affected_side, task_status,
  capture_quality, duration_ms, repetitions, report_json, pose_file,
  pose_bytes, pose_sha256, created_at
)
SELECT
  id, patient_id, task_id, observed_at, affected_side, task_status,
  capture_quality, duration_ms, repetitions, report_json, pose_file,
  pose_bytes, pose_sha256, created_at
FROM observations_previous;

DROP TABLE observations_previous;
