CREATE TABLE observation_media (
  observation_id TEXT PRIMARY KEY NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  manifest_json TEXT NOT NULL
);
