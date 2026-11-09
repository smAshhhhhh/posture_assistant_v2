CREATE TABLE patients (
  id TEXT PRIMARY KEY NOT NULL,
  patient_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  photo_file TEXT CHECK (photo_file IS NULL OR length(photo_file) = 40),
  age_years INTEGER CHECK (
    age_years IS NULL OR (typeof(age_years) = 'integer' AND age_years BETWEEN 0 AND 120)
  ),
  affected_side TEXT NOT NULL CHECK (affected_side IN ('left', 'right')),
  onset_date TEXT,
  ability_level TEXT CHECK (ability_level IS NULL OR ability_level IN ('mild', 'moderate', 'severe')),
  ability_assessor TEXT,
  ability_assessed_on TEXT,
  consent_recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  CHECK (length(patient_code) BETWEEN 2 AND 32),
  CHECK (
    (ability_level IS NULL AND ability_assessor IS NULL AND ability_assessed_on IS NULL)
    OR
    (ability_level IS NOT NULL AND ability_assessor IS NOT NULL AND ability_assessed_on IS NOT NULL)
  )
);

CREATE TABLE clinical_assessments (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  scale TEXT NOT NULL CHECK (scale IN ('fma_upper', 'fma_lower', 'berg', 'barthel')),
  score INTEGER NOT NULL CHECK (
    typeof(score) = 'integer' AND score >= 0 AND
    ((scale = 'fma_upper' AND score <= 66) OR
     (scale = 'fma_lower' AND score <= 34) OR
     (scale = 'berg' AND score <= 56) OR
     (scale = 'barthel' AND score <= 100))
  ),
  assessed_on TEXT NOT NULL,
  assessor TEXT NOT NULL CHECK (length(assessor) BETWEEN 1 AND 60),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  created_at TEXT NOT NULL
);

CREATE INDEX clinical_assessments_patient_date
ON clinical_assessments(patient_id, assessed_on DESC, created_at DESC);

CREATE INDEX patients_updated_at ON patients(updated_at DESC, id);
